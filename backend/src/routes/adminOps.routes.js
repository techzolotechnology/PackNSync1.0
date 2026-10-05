import { Router } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { notifyUser } from '../utils/notify.js';
import { logAdminAction } from '../utils/audit.js';
import { creditPromo, refundDebit } from '../utils/wallet.js';
import { getUserVerificationState } from '../utils/verificationHelpers.js';

/**
 * Admin operations: overview metrics, user 360°, wallet/withdrawal ops and the
 * audit log. Mounted inside adminRouter, so authenticate + ADMIN already apply.
 */
export const adminOpsRouter = Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PROMO_GRANT = 5000;

/** YYYY-MM-DD in India time, so daily buckets match the team's calendar. */
const istDay = (date) => new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

function dailySeries(days, rows, valueOf = () => 1) {
    const buckets = new Map();
    for (let i = days - 1; i >= 0; i -= 1) buckets.set(istDay(Date.now() - i * DAY_MS), 0);
    for (const row of rows) {
        const key = istDay(row.createdAt);
        if (buckets.has(key)) buckets.set(key, buckets.get(key) + valueOf(row));
    }
    return [...buckets.entries()].map(([date, value]) => ({ date, value }));
}

// GET /api/admin/overview — action queue + growth + money
adminOpsRouter.get('/overview', async (_req, res) => {
    const since30 = new Date(Date.now() - 30 * DAY_MS);
    const since7 = new Date(Date.now() - 7 * DAY_MS);

    const [
        pendingKyc,
        vehiclesAwaitingReview,
        pendingWithdrawals,
        pendingBookings,
        signups7,
        signups30,
        referredSignups30,
        walletTotals,
        referralRewards,
        newUsers,
        payments30,
        tripsCreated30,
        openReports,
        highPriorityReports,
        earningsOnHold,
        stuckTopups,
        commission30,
        owedToHosts,
    ] = await Promise.all([
        prisma.verification.count({ where: { status: 'PENDING' } }),
        prisma.vehicle.count({ where: { isVerified: false, rcUrl: { not: null } } }),
        prisma.walletTransaction.aggregate({
            where: { type: 'WITHDRAW', status: 'PENDING' },
            _count: { _all: true },
            _sum: { amount: true },
        }),
        prisma.rentalBooking.count({ where: { status: 'PENDING' } }),
        prisma.user.count({ where: { createdAt: { gte: since7 } } }),
        prisma.user.count({ where: { createdAt: { gte: since30 } } }),
        prisma.user.count({ where: { createdAt: { gte: since30 }, referredById: { not: null } } }),
        prisma.wallet.aggregate({ _sum: { balance: true, promoBalance: true } }),
        prisma.walletTransaction.count({
            where: { type: 'ADJUST', status: 'SUCCESS', referenceId: { startsWith: 'referral_', endsWith: '_referrer' } },
        }),
        prisma.user.findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true } }),
        prisma.payment.findMany({
            where: { createdAt: { gte: since30 }, status: 'succeeded' },
            select: { createdAt: true, amount: true },
        }),
        prisma.trip.count({ where: { createdAt: { gte: since30 } } }),
        prisma.report.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
        prisma.report.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] }, priority: 'HIGH' } }),
        prisma.hostEarning.count({ where: { status: 'ON_HOLD' } }),
        prisma.walletTransaction.count({ where: { type: 'TOPUP', status: 'PENDING', createdAt: { lte: new Date(Date.now() - 30 * 60 * 1000) } } }),
        prisma.hostEarning.aggregate({ where: { createdAt: { gte: since30 }, booking: { status: 'PAID' } }, _sum: { platformFee: true } }),
        prisma.hostEarning.aggregate({ where: { status: { in: ['PENDING', 'ON_HOLD'] } }, _sum: { amount: true } }),
    ]);

    res.json({
        success: true,
        data: {
            queue: {
                pendingKyc,
                vehiclesAwaitingReview,
                pendingWithdrawals: pendingWithdrawals._count._all,
                pendingWithdrawalAmount: pendingWithdrawals._sum.amount || 0,
                pendingBookings,
                openReports,
                highPriorityReports,
                earningsOnHold,
                stuckTopups,
            },
            growth: {
                signups7,
                signups30,
                referredSignups30,
                referralRewards,
                tripsCreated30,
            },
            money: {
                gmv30: payments30.reduce((sum, p) => sum + p.amount, 0),
                paidBookings30: payments30.length,
                walletCashHeld: walletTotals._sum.balance || 0,
                promoOutstanding: walletTotals._sum.promoBalance || 0,
                commission30: commission30._sum.platformFee || 0,
                owedToHosts: owedToHosts._sum.amount || 0,
            },
            series: {
                signups: dailySeries(30, newUsers),
                revenue: dailySeries(30, payments30, (p) => p.amount),
            },
        },
    });
});

// GET /api/admin/users/:id/detail — everything about one user
adminOpsRouter.get('/users/:id/detail', async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
            id: true, name: true, email: true, phoneNumber: true, avatarUrl: true, city: true,
            role: true, isBanned: true, banReason: true, createdAt: true, referralCode: true, totpEnabled: true,
            referredBy: { select: { id: true, name: true } },
            _count: {
                select: {
                    referrals: true, organizedTrips: true, memberships: true,
                    vehicles: true, rentalListings: true, rentalBookings: true,
                },
            },
        },
    });
    if (!user) throw new AppError('User not found.', 404);

    const [wallet, bookings, verification, audit] = await Promise.all([
        prisma.wallet.findUnique({
            where: { userId: user.id },
            include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
        }),
        prisma.rentalBooking.findMany({
            where: { renterId: user.id },
            include: { listing: { include: { vehicle: { select: { make: true, model: true } } } } },
            orderBy: { createdAt: 'desc' },
            take: 10,
        }),
        getUserVerificationState(user.id),
        prisma.adminAuditLog.findMany({
            where: { targetType: 'USER', targetId: user.id },
            include: { admin: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 10,
        }),
    ]);

    res.json({
        success: true,
        data: {
            user,
            wallet: wallet
                ? { balance: wallet.balance, promoBalance: wallet.promoBalance, transactions: wallet.transactions }
                : { balance: 0, promoBalance: 0, transactions: [] },
            bookings,
            verification: {
                isFullyVerified: verification.isFullyVerified,
                documents: verification.verifications.map((v) => ({
                    id: v.id, documentType: v.documentType, status: v.status,
                    rejectionReason: v.rejectionReason, createdAt: v.createdAt,
                })),
            },
            audit,
        },
    });
});

// POST /api/admin/users/:id/promo { amount, reason } — goodwill / support credit
adminOpsRouter.post('/users/:id/promo', async (req, res) => {
    const amount = Number(req.body?.amount);
    const reason = String(req.body?.reason || '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_PROMO_GRANT) {
        throw new AppError(`Promo credit must be between ₹1 and ₹${MAX_PROMO_GRANT}.`, 400);
    }
    if (reason.length < 3) throw new AppError('Give a reason for the credit.', 400);

    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, name: true } });
    if (!user) throw new AppError('User not found.', 404);

    const { wallet } = await creditPromo({
        userId: user.id,
        amount,
        referenceId: `admin_promo_${randomUUID()}`,
        description: `Credit from PickAndSync: ${reason.slice(0, 120)}`,
        metadata: { grantedBy: req.user.id, reason },
    });

    await notifyUser({
        userId: user.id,
        type: 'SYSTEM',
        title: `₹${amount.toLocaleString('en-IN')} credit added`,
        body: `The PickAndSync team added promo credit to your wallet: ${reason}`,
        data: { promo: true },
    });
    await logAdminAction(req, {
        action: 'PROMO_GRANT', targetType: 'USER', targetId: user.id,
        summary: `Granted ₹${amount.toLocaleString('en-IN')} promo credit to ${user.name}: ${reason}`,
        metadata: { amount, reason },
    });

    res.json({ success: true, data: { promoBalance: wallet.promoBalance } });
});

const withdrawalInclude = {
    wallet: { select: { userId: true, user: { select: { id: true, name: true, email: true } } } },
};

// GET /api/admin/wallet/withdrawals?status=PENDING
adminOpsRouter.get('/wallet/withdrawals', async (req, res) => {
    const status = String(req.query.status || 'PENDING').toUpperCase();
    const rows = await prisma.walletTransaction.findMany({
        where: { type: 'WITHDRAW', ...(status === 'ALL' ? {} : { status }) },
        include: withdrawalInclude,
        orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
        take: 100,
    });
    res.json({ success: true, data: rows });
});

async function loadPendingWithdrawal(id) {
    const tx = await prisma.walletTransaction.findUnique({ where: { id }, include: withdrawalInclude });
    if (!tx || tx.type !== 'WITHDRAW') throw new AppError('Withdrawal not found.', 404);
    if (tx.status !== 'PENDING') throw new AppError(`This withdrawal is already ${tx.status}.`, 409);
    return tx;
}

// POST /api/admin/wallet/withdrawals/:id/complete { reference } — paid out manually (UPI/bank)
adminOpsRouter.post('/wallet/withdrawals/:id/complete', async (req, res) => {
    const reference = String(req.body?.reference || '').trim();
    if (reference.length < 4) throw new AppError('Enter the UPI/bank transfer reference (UTR).', 400);

    const tx = await loadPendingWithdrawal(req.params.id);
    const metadata = {
        ...(tx.metadata || {}),
        manualSettlement: { reference: reference.slice(0, 80), by: req.user.id, at: new Date().toISOString() },
    };
    // Conditional on PENDING so two admins cannot settle the same request twice.
    const settled = await prisma.walletTransaction.updateMany({
        where: { id: tx.id, status: 'PENDING' },
        data: { status: 'SUCCESS', metadata },
    });
    if (settled.count === 0) throw new AppError('This withdrawal was already handled.', 409);

    const user = tx.wallet.user;
    await notifyUser({
        userId: user.id,
        type: 'PAYMENT_RECEIVED',
        title: 'Withdrawal sent',
        body: `₹${tx.amount.toLocaleString('en-IN')} has been sent to your account (ref ${reference.slice(0, 40)}).`,
        data: { transactionId: tx.id },
    });
    await logAdminAction(req, {
        action: 'WITHDRAWAL_COMPLETE', targetType: 'WITHDRAWAL', targetId: tx.id,
        summary: `Marked ₹${tx.amount.toLocaleString('en-IN')} withdrawal for ${user.name} as paid (ref ${reference.slice(0, 40)})`,
        metadata: { userId: user.id, amount: tx.amount, reference },
    });

    res.json({ success: true, message: 'Withdrawal marked as paid.' });
});

// POST /api/admin/wallet/withdrawals/:id/reject { reason } — return the held money to the wallet
adminOpsRouter.post('/wallet/withdrawals/:id/reject', async (req, res) => {
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 3) throw new AppError('Give a reason so the user knows what to fix.', 400);

    const tx = await loadPendingWithdrawal(req.params.id);
    const updated = await refundDebit({ txId: tx.id, reason: `Withdrawal rejected: ${reason.slice(0, 200)}` });
    if (updated.status !== 'FAILED') throw new AppError('This withdrawal was already handled.', 409);

    const user = tx.wallet.user;
    await notifyUser({
        userId: user.id,
        type: 'SYSTEM',
        title: 'Withdrawal returned to wallet',
        body: `Your ₹${tx.amount.toLocaleString('en-IN')} withdrawal could not be sent: ${reason}. The amount is back in your wallet.`,
        data: { transactionId: tx.id },
    });
    await logAdminAction(req, {
        action: 'WITHDRAWAL_REJECT', targetType: 'WITHDRAWAL', targetId: tx.id,
        summary: `Rejected ₹${tx.amount.toLocaleString('en-IN')} withdrawal for ${user.name}: ${reason}`,
        metadata: { userId: user.id, amount: tx.amount, reason },
    });

    res.json({ success: true, message: 'Withdrawal rejected and refunded.' });
});

// GET /api/admin/wallet/transactions?type=&status=&q=
adminOpsRouter.get('/wallet/transactions', async (req, res) => {
    const type = String(req.query.type || '').toUpperCase();
    const status = String(req.query.status || '').toUpperCase();
    const q = String(req.query.q || '').trim();

    const where = {};
    if (['TOPUP', 'SPEND', 'REFUND', 'WITHDRAW', 'ADJUST'].includes(type)) where.type = type;
    if (['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'].includes(status)) where.status = status;
    if (q) {
        where.OR = [
            { referenceId: { contains: q, mode: 'insensitive' } },
            { wallet: { user: { name: { contains: q, mode: 'insensitive' } } } },
            { wallet: { user: { email: { contains: q, mode: 'insensitive' } } } },
        ];
    }

    const rows = await prisma.walletTransaction.findMany({
        where,
        include: withdrawalInclude,
        orderBy: { createdAt: 'desc' },
        take: 200,
    });
    res.json({ success: true, data: rows });
});

// GET /api/admin/audit?action=&targetType=&targetId=
adminOpsRouter.get('/audit', async (req, res) => {
    const where = {};
    if (req.query.action) where.action = String(req.query.action).toUpperCase();
    if (req.query.targetType) where.targetType = String(req.query.targetType).toUpperCase();
    if (req.query.targetId) where.targetId = String(req.query.targetId);

    const [rows, actions] = await Promise.all([
        prisma.adminAuditLog.findMany({
            where,
            include: { admin: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: 200,
        }),
        prisma.adminAuditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
    ]);
    res.json({ success: true, data: rows, actions: actions.map((a) => a.action) });
});
