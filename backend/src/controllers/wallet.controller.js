import { randomUUID } from 'crypto';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import {
    cashfreeConfigured,
    cashfreeMockEnabled,
    cashfreeMode,
    createPgOrder,
    getPgOrder,
    payoutsConfigured,
    createPayoutTransfer,
} from '../utils/cashfree.js';
import {
    getOrCreateWallet,
    creditWallet,
    debitWallet,
    refundDebit,
    markWithdrawSuccess,
} from '../utils/wallet.js';
import { sendMail, smtpConfigured } from '../utils/mailer.js';
import { walletTopupEmail } from '../utils/emailTemplates.js';

const MIN_TOPUP = 10;
const MAX_TOPUP = 100000;
const MIN_WITHDRAW = 100;

function frontendBase() {
    return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function apiPublicBase(req) {
    if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/$/, '');
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    return `${proto}://${host}`;
}

// GET /api/wallet
export const getWallet = async (req, res) => {
    const wallet = await getOrCreateWallet(req.user.id);
    res.json({
        success: true,
        data: {
            id: wallet.id,
            balance: wallet.balance,
            currency: wallet.currency,
            cashfreeMode: cashfreeMode(),
            mockMode: cashfreeMockEnabled(),
            payoutsReady: payoutsConfigured() || cashfreeMockEnabled(),
        },
    });
};

// GET /api/wallet/transactions
export const listTransactions = async (req, res) => {
    const wallet = await getOrCreateWallet(req.user.id);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const rows = await prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
    res.json({ success: true, data: rows });
};

// POST /api/wallet/topup  { amount }
export const createTopup = async (req, res) => {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
        throw new AppError(`Top-up amount must be between ₹${MIN_TOPUP} and ₹${MAX_TOPUP}.`, 400);
    }

    const wallet = await getOrCreateWallet(req.user.id);
    const orderId = `wlt_${Date.now()}_${randomUUID().slice(0, 8)}`;

    const pending = await prisma.walletTransaction.create({
        data: {
            walletId: wallet.id,
            type: 'TOPUP',
            status: 'PENDING',
            amount,
            description: 'Wallet top-up via Cashfree',
            referenceId: orderId,
            provider: 'CASHFREE',
            metadata: { source: 'topup' },
        },
    });

    // Mock / local: credit immediately so the product works without Cashfree keys
    if (cashfreeMockEnabled()) {
        const { wallet: updated, transaction } = await creditWallet({
            userId: req.user.id,
            amount,
            type: 'TOPUP',
            referenceId: orderId,
            description: 'Wallet top-up (mock)',
            provider: 'MOCK',
            txId: pending.id,
            metadata: { mock: true },
        });
        try {
            await sendWalletTopupEmail({
                userId: req.user.id,
                amount,
                balance: updated.balance,
                orderId,
            });
        } catch (err) {
            console.error('[wallet top-up email]', err.message || err);
        }
        return res.json({
            success: true,
            mock: true,
            data: {
                orderId,
                amount,
                balance: updated.balance,
                transaction,
            },
        });
    }

    if (!cashfreeConfigured()) {
        await prisma.walletTransaction.update({
            where: { id: pending.id },
            data: { status: 'FAILED', description: 'Cashfree not configured' },
        });
        throw new AppError('Cashfree is not configured on the server.', 503);
    }

    const returnUrl = `${frontendBase()}/wallet?topup=return&order_id={order_id}`;
    const notifyUrl = `${apiPublicBase(req)}/api/wallet/webhook/cashfree`;

    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, name: true, email: true, phone: true },
    });

    try {
        const order = await createPgOrder({
            orderId,
            amount,
            customerId: user.id,
            customerPhone: user.phone,
            customerEmail: user.email,
            customerName: user.name,
            returnUrl,
            notifyUrl,
            orderNote: 'PickAndSync wallet top-up',
        });

        await prisma.walletTransaction.update({
            where: { id: pending.id },
            data: {
                metadata: {
                    source: 'topup',
                    cf_order_id: order.cf_order_id,
                    payment_session_id: order.payment_session_id,
                },
            },
        });

        res.json({
            success: true,
            mock: false,
            data: {
                orderId,
                amount,
                paymentSessionId: order.payment_session_id,
                cashfreeMode: cashfreeMode(),
                transactionId: pending.id,
            },
        });
    } catch (err) {
        await prisma.walletTransaction.update({
            where: { id: pending.id },
            data: { status: 'FAILED', description: err.message },
        });
        throw new AppError(err.message || 'Failed to create Cashfree order.', 502);
    }
};

async function settleTopupIfPaid(orderId, userIdHint) {
    const pending = await prisma.walletTransaction.findFirst({
        where: { referenceId: orderId, type: 'TOPUP' },
        include: { wallet: true },
    });
    if (!pending) return { ok: false, reason: 'unknown_order' };
    if (pending.status === 'SUCCESS') {
        return { ok: true, duplicate: true, wallet: pending.wallet, transaction: pending };
    }

    let paid = cashfreeMockEnabled();
    if (!paid && cashfreeConfigured()) {
        const order = await getPgOrder(orderId);
        paid = String(order.order_status || '').toUpperCase() === 'PAID';
    }

    if (!paid) {
        return { ok: false, reason: 'not_paid', transaction: pending };
    }

    const userId = userIdHint || pending.wallet.userId;
    const result = await creditWallet({
        userId,
        amount: pending.amount,
        type: 'TOPUP',
        referenceId: orderId,
        description: 'Wallet top-up via Cashfree',
        provider: 'CASHFREE',
        txId: pending.id,
        metadata: { verified: true },
    });

    // Email once when credit actually lands (skip duplicate settles)
    if (!result.duplicate) {
        try {
            await sendWalletTopupEmail({
                userId,
                amount: pending.amount,
                balance: result.wallet.balance,
                orderId,
            });
        } catch (err) {
            console.error('[wallet top-up email]', err.message || err);
        }
    }

    return { ok: true, ...result };
}

async function sendWalletTopupEmail({ userId, amount, balance, orderId }) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
    });
    if (!user?.email) {
        console.log('[DEV] Wallet top-up email skipped — user has no email.');
        return;
    }

    const { html, text } = walletTopupEmail({
        userName: user.name,
        amount,
        balance,
        orderId,
    });
    const subject = `Wallet topped up — ₹${Number(amount).toLocaleString('en-IN')}`;

    if (!smtpConfigured()) {
        console.log(`[DEV] Wallet top-up email to ${user.email}: ${subject}`);
        console.log(text);
        return;
    }

    await sendMail({ to: user.email, subject, html, text });
}

// POST /api/wallet/topup/verify  { orderId }
export const verifyTopup = async (req, res) => {
    const orderId = req.body.orderId || req.body.order_id;
    if (!orderId) throw new AppError('orderId is required.', 400);

    const pending = await prisma.walletTransaction.findFirst({
        where: { referenceId: orderId, type: 'TOPUP' },
        include: { wallet: true },
    });
    if (!pending) throw new AppError('Top-up order not found.', 404);
    if (pending.wallet.userId !== req.user.id) throw new AppError('Not your top-up order.', 403);

    const result = await settleTopupIfPaid(orderId, req.user.id);
    if (!result.ok && result.reason === 'not_paid') {
        return res.json({
            success: true,
            paid: false,
            data: { orderId, status: result.transaction?.status || 'PENDING' },
        });
    }
    if (!result.ok) throw new AppError('Could not verify top-up.', 400);

    res.json({
        success: true,
        paid: true,
        duplicate: Boolean(result.duplicate),
        data: {
            orderId,
            balance: result.wallet.balance,
            transaction: result.transaction,
        },
    });
};

// POST /api/wallet/webhook/cashfree — Cashfree PG notify
export const cashfreeWebhook = async (req, res) => {
    const payload = req.body || {};
    const orderId =
        payload?.data?.order?.order_id
        || payload?.order?.order_id
        || payload?.order_id
        || payload?.data?.order_id;

    const type = payload?.type || payload?.event || '';
    const looksPaid =
        String(type).toUpperCase().includes('SUCCESS')
        || String(payload?.data?.payment?.payment_status || '').toUpperCase() === 'SUCCESS'
        || String(payload?.data?.order?.order_status || '').toUpperCase() === 'PAID';

    if (orderId && looksPaid) {
        try {
            await settleTopupIfPaid(orderId);
        } catch (err) {
            console.error('[wallet webhook] settle failed', err.message);
        }
    }

    res.json({ received: true });
};

// POST /api/wallet/withdraw  { amount, mode, upiId | accountNumber, ifsc, accountName }
export const withdraw = async (req, res) => {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) {
        throw new AppError(`Minimum withdrawal is ₹${MIN_WITHDRAW}.`, 400);
    }

    const mode = String(req.body.mode || 'upi').toLowerCase();
    const accountName = String(req.body.accountName || req.user.name || '').trim();
    if (!accountName) throw new AppError('Account holder name is required.', 400);

    let payoutMeta = { mode };
    if (mode === 'upi') {
        const upiId = String(req.body.upiId || '').trim();
        if (!upiId || !upiId.includes('@')) {
            throw new AppError('Valid UPI ID is required (e.g. name@upi).', 400);
        }
        payoutMeta.upiId = upiId;
    } else if (mode === 'bank') {
        const accountNumber = String(req.body.accountNumber || '').replace(/\s/g, '');
        const ifsc = String(req.body.ifsc || '').trim().toUpperCase();
        if (!accountNumber || accountNumber.length < 8) {
            throw new AppError('Valid bank account number is required.', 400);
        }
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
            throw new AppError('Valid IFSC is required.', 400);
        }
        payoutMeta.accountNumber = accountNumber;
        payoutMeta.ifsc = ifsc;
    } else {
        throw new AppError('mode must be "upi" or "bank".', 400);
    }

    const transferId = `wd_${Date.now()}_${randomUUID().slice(0, 8)}`;

    const { wallet, transaction } = await debitWallet({
        userId: req.user.id,
        amount,
        type: 'WITHDRAW',
        status: 'PENDING',
        referenceId: transferId,
        description: `Withdrawal to ${mode === 'upi' ? payoutMeta.upiId : 'bank'}`,
        provider: 'CASHFREE',
        metadata: { ...payoutMeta, accountName },
    });

    // Mock: mark success immediately (money left the wallet; pretend bank credited)
    if (cashfreeMockEnabled() && !payoutsConfigured()) {
        await markWithdrawSuccess(transaction.id, { ...payoutMeta, mock: true });
        return res.json({
            success: true,
            mock: true,
            data: {
                transferId,
                amount,
                balance: wallet.balance,
                status: 'SUCCESS',
                message: 'Mock withdrawal completed. Configure Cashfree Payouts for real bank/UPI transfers.',
            },
        });
    }

    if (!payoutsConfigured()) {
        // Balance already held; ops can settle manually / retry when payouts are live
        return res.json({
            success: true,
            pending: true,
            data: {
                transferId,
                amount,
                balance: wallet.balance,
                status: 'PENDING',
                message: 'Withdrawal queued. Cashfree Payouts credentials are not configured yet — funds are held from your wallet.',
            },
        });
    }

    try {
        const result = await createPayoutTransfer({
            transferId,
            amount,
            transferMode: mode === 'upi' ? 'upi' : 'banktransfer',
            beneficiaryName: accountName,
            bankAccount: payoutMeta.accountNumber,
            ifsc: payoutMeta.ifsc,
            vpa: payoutMeta.upiId,
            remarks: 'PickAndSync wallet withdrawal',
        });

        await markWithdrawSuccess(transaction.id, {
            ...payoutMeta,
            accountName,
            payoutResponse: result,
        });

        res.json({
            success: true,
            data: {
                transferId,
                amount,
                balance: wallet.balance,
                status: 'SUCCESS',
                message: 'Withdrawal submitted to Cashfree Payouts.',
            },
        });
    } catch (err) {
        await refundDebit({ txId: transaction.id, reason: `Payout failed: ${err.message}` });
        const restored = await getOrCreateWallet(req.user.id);
        throw new AppError(err.message || 'Withdrawal failed. Amount returned to wallet.', 502);
    }
};

// POST /api/wallet/spend — internal helper for other modules (optional direct spend)
export const spendFromWallet = async (req, res) => {
    const amount = Number(req.body.amount);
    const referenceId = req.body.referenceId || `spend_${randomUUID()}`;
    const description = req.body.description || 'In-app spend';

    const result = await debitWallet({
        userId: req.user.id,
        amount,
        type: 'SPEND',
        status: 'SUCCESS',
        referenceId,
        description,
        provider: 'INTERNAL',
        metadata: req.body.metadata || undefined,
    });

    res.json({
        success: true,
        duplicate: Boolean(result.duplicate),
        data: {
            balance: result.wallet.balance,
            transaction: result.transaction,
        },
    });
};
