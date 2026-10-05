import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { logAdminAction } from '../utils/audit.js';
import { releaseDueEarnings, releaseEarning } from '../utils/hostEarnings.js';
import { platformFeePercent, earningReleaseHours } from '../utils/commission.js';
import { reconcileStuckTopups, reconcileTopup } from '../controllers/wallet.controller.js';

/** Host earnings (commission payouts) and stuck top-up cleanup. */
export const adminMoneyRouter = Router();

const earningInclude = {
    host: { select: { id: true, name: true, email: true } },
    booking: {
        select: {
            id: true, startDate: true, endDate: true, totalPrice: true, hostAmount: true, platformFee: true, status: true,
            renter: { select: { id: true, name: true } },
            listing: { select: { vehicle: { select: { make: true, model: true, licensePlate: true } } } },
        },
    },
};

// GET /api/admin/earnings?status=
adminMoneyRouter.get('/earnings', async (req, res) => {
    const status = String(req.query.status || '').toUpperCase();
    const where = ['PENDING', 'ON_HOLD', 'RELEASED', 'CANCELLED'].includes(status) ? { status } : {};

    const [rows, totals, commission] = await Promise.all([
        prisma.hostEarning.findMany({ where, include: earningInclude, orderBy: { releaseAt: 'asc' }, take: 200 }),
        prisma.hostEarning.groupBy({ by: ['status'], _sum: { amount: true, platformFee: true }, _count: { _all: true } }),
        // A refund returns the fee to the renter, so only still-paid bookings count
        prisma.hostEarning.aggregate({ where: { booking: { status: 'PAID' } }, _sum: { platformFee: true } }),
    ]);
    const byStatus = Object.fromEntries(totals.map((t) => [t.status, { amount: t._sum.amount || 0, fee: t._sum.platformFee || 0, count: t._count._all }]));
    const dueNow = rows.filter((r) => r.status === 'PENDING' && new Date(r.releaseAt) <= new Date()).length;

    res.json({
        success: true,
        data: rows,
        summary: {
            feePercent: platformFeePercent(),
            releaseHours: earningReleaseHours(),
            owedToHosts: (byStatus.PENDING?.amount || 0) + (byStatus.ON_HOLD?.amount || 0),
            onHold: byStatus.ON_HOLD?.amount || 0,
            paidToHosts: byStatus.RELEASED?.amount || 0,
            commissionEarned: commission._sum.platformFee || 0,
            dueNow,
        },
    });
});

// POST /api/admin/earnings/release-due — run the release sweep now
adminMoneyRouter.post('/earnings/release-due', async (req, res) => {
    const result = await releaseDueEarnings();
    if (result.released) {
        await logAdminAction(req, {
            action: 'EARNING_RELEASE_DUE', targetType: 'EARNING',
            summary: `Released ${result.released} due host earning(s)`, metadata: result,
        });
    }
    res.json({ success: true, data: result });
});

// POST /api/admin/earnings/:id/release — release one now (early, or after a hold)
adminMoneyRouter.post('/earnings/:id/release', async (req, res) => {
    const note = String(req.body?.note || '').trim() || undefined;
    const earning = await releaseEarning(req.params.id, { note });
    await logAdminAction(req, {
        action: 'EARNING_RELEASE', targetType: 'EARNING', targetId: earning.id,
        summary: `Released ₹${earning.amount.toLocaleString('en-IN')} to host${note ? `: ${note}` : ''}`,
        metadata: { hostId: earning.hostId, bookingId: earning.bookingId, amount: earning.amount },
    });
    res.json({ success: true, message: 'Earning released to the host wallet.' });
});

// POST /api/admin/earnings/:id/hold { note } — freeze while a dispute is checked
adminMoneyRouter.post('/earnings/:id/hold', async (req, res) => {
    const note = String(req.body?.note || '').trim();
    if (note.length < 3) throw new AppError('Say why the earning is on hold.', 400);
    const held = await prisma.hostEarning.updateMany({
        where: { id: req.params.id, status: 'PENDING' },
        data: { status: 'ON_HOLD', note: note.slice(0, 300) },
    });
    if (!held.count) throw new AppError('Only pending earnings can be put on hold.', 409);
    await logAdminAction(req, {
        action: 'EARNING_HOLD', targetType: 'EARNING', targetId: req.params.id,
        summary: `Put host earning on hold: ${note}`,
    });
    res.json({ success: true, message: 'Earning on hold.' });
});

// GET /api/admin/wallet/stuck-topups — PENDING top-ups older than 30 minutes
adminMoneyRouter.get('/wallet/stuck-topups', async (_req, res) => {
    const rows = await prisma.walletTransaction.findMany({
        where: { type: 'TOPUP', status: 'PENDING', createdAt: { lte: new Date(Date.now() - 30 * 60 * 1000) } },
        include: { wallet: { select: { user: { select: { id: true, name: true, email: true } } } } },
        orderBy: { createdAt: 'asc' },
        take: 200,
    });
    res.json({ success: true, data: rows });
});

// POST /api/admin/wallet/topups/:id/recheck
adminMoneyRouter.post('/wallet/topups/:id/recheck', async (req, res) => {
    const result = await reconcileTopup(req.params.id);
    await logAdminAction(req, {
        action: 'TOPUP_RECHECK', targetType: 'WALLET_TX', targetId: req.params.id,
        summary: `Re-checked top-up with Cashfree: ${result.outcome}`, metadata: result,
    });
    res.json({ success: true, data: result });
});

// POST /api/admin/wallet/topups/recheck-all
adminMoneyRouter.post('/wallet/topups/recheck-all', async (req, res) => {
    const result = await reconcileStuckTopups({ limit: 50 });
    await logAdminAction(req, {
        action: 'TOPUP_RECHECK', targetType: 'WALLET_TX',
        summary: `Re-checked ${result.checked} stuck top-up(s)`, metadata: result,
    });
    res.json({ success: true, data: result });
});
