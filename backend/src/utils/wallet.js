import { prisma } from './prisma.js';
import { AppError } from './AppError.js';
import { consumePromoGrants, expireDueGrantsForUser, recordPromoGrant } from './promoGrants.js';

export async function getOrCreateWallet(userId, tx = prisma) {
    // upsert avoids a unique-constraint race when two requests create the wallet at once
    return tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0, promoBalance: 0, currency: 'INR' },
    });
}

/** Run fn inside the caller's transaction, or open a new one. */
function inTransaction(tx, fn) {
    return tx ? fn(tx) : prisma.$transaction(fn);
}

/**
 * Credit wallet after successful top-up / refund. Idempotent on referenceId + SUCCESS TOPUP/REFUND.
 *
 * When txId is given, the PENDING row is claimed with a conditional update
 * (PENDING -> SUCCESS) before the balance moves, so a webhook and a verify
 * call racing on the same order can only credit once.
 */
export async function creditWallet({
    userId,
    amount,
    type = 'TOPUP',
    referenceId,
    description,
    provider = 'CASHFREE',
    metadata,
    txId, // optional existing PENDING tx to complete
    tx: outerTx,
}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
        throw new AppError('Credit amount must be positive.', 400);
    }

    return inTransaction(outerTx, async (tx) => {
        if (txId) {
            const claimed = await tx.walletTransaction.updateMany({
                where: { id: txId, status: 'PENDING' },
                data: { status: 'SUCCESS' },
            });
            if (claimed.count === 0) {
                const existing = await tx.walletTransaction.findUnique({ where: { id: txId } });
                if (existing?.status === 'SUCCESS') {
                    const wallet = await getOrCreateWallet(userId, tx);
                    return { wallet, transaction: existing, duplicate: true };
                }
                throw new AppError('Transaction is not pending.', 409);
            }
        } else if (referenceId) {
            const already = await tx.walletTransaction.findFirst({
                where: {
                    referenceId,
                    status: 'SUCCESS',
                    type: { in: ['TOPUP', 'REFUND', 'ADJUST', 'EARNING'] },
                },
            });
            if (already) {
                const wallet = await getOrCreateWallet(userId, tx);
                return { wallet, transaction: already, duplicate: true };
            }
        }

        const wallet = await getOrCreateWallet(userId, tx);
        const updated = await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: value } },
        });

        let transaction;
        if (txId) {
            transaction = await tx.walletTransaction.update({
                where: { id: txId },
                data: {
                    balanceAfter: updated.balance,
                    description: description || undefined,
                    metadata: metadata || undefined,
                    provider,
                },
            });
        } else {
            transaction = await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type,
                    status: 'SUCCESS',
                    amount: value,
                    balanceAfter: updated.balance,
                    description,
                    referenceId,
                    provider,
                    metadata,
                },
            });
        }

        return { wallet: updated, transaction, duplicate: false };
    });
}

/**
 * Debit for in-app spend or withdrawal hold.
 * For WITHDRAW: creates PENDING debit (balance reduced) until payout settles.
 * For SPEND: SUCCESS immediately.
 *
 * The balance check and the decrement are a single conditional UPDATE, so
 * concurrent debits can never take the balance below zero.
 */
export async function debitWallet({
    userId,
    amount,
    type = 'SPEND',
    status = 'SUCCESS',
    referenceId,
    description,
    provider = 'INTERNAL',
    metadata,
    tx: outerTx,
}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
        throw new AppError('Debit amount must be positive.', 400);
    }

    return inTransaction(outerTx, async (tx) => {
        if (referenceId && type === 'SPEND') {
            const already = await tx.walletTransaction.findFirst({
                where: { referenceId, type: 'SPEND', status: 'SUCCESS' },
            });
            if (already) {
                const wallet = await getOrCreateWallet(userId, tx);
                return { wallet, transaction: already, duplicate: true };
            }
        }

        // Promo credit is spent first on in-app spends; withdrawals use cash only.
        const usePromo = type === 'SPEND';
        // Credit past its expiry date must not pay for anything, even before the sweep runs.
        if (usePromo) await expireDueGrantsForUser(tx, userId);
        let wallet;
        let promoUsed = 0;
        for (let attempt = 0; ; attempt += 1) {
            wallet = await getOrCreateWallet(userId, tx);
            promoUsed = usePromo ? Math.min(wallet.promoBalance || 0, value) : 0;
            const cashPart = value - promoUsed;
            if (wallet.balance < cashPart) {
                throw new AppError('Insufficient wallet balance.', 400);
            }
            // Compare-and-swap on both balances: a concurrent debit changes them,
            // the update matches nothing, and we re-read and re-check.
            const debited = await tx.wallet.updateMany({
                where: { id: wallet.id, balance: wallet.balance, promoBalance: wallet.promoBalance },
                data: {
                    balance: { decrement: cashPart },
                    promoBalance: { decrement: promoUsed },
                },
            });
            if (debited.count === 1) break;
            if (attempt >= 4) throw new AppError('Wallet is busy. Please try again.', 409);
        }
        const updated = await tx.wallet.findUnique({ where: { id: wallet.id } });
        // Which credit blocks paid, so a refund can give back exactly those.
        const promoGrants = promoUsed > 0 ? await consumePromoGrants(tx, userId, promoUsed) : [];

        const transaction = await tx.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type,
                status,
                amount: value,
                balanceAfter: updated.balance,
                description,
                referenceId,
                provider,
                metadata: promoUsed > 0 ? { ...(metadata || {}), promoUsed, promoGrants } : metadata,
            },
        });

        return { wallet: updated, transaction, duplicate: false };
    });
}

/**
 * Grant promotional credit (referral rewards, admin credit, offers). Idempotent
 * on referenceId. Promo credit pays for bookings but is never withdrawable;
 * with `expiresAt` the unspent part is removed on that date.
 *
 * `source` is ADMIN | OFFER | REFERRAL | REFUND (see promo_grants).
 */
export async function creditPromo({
    userId,
    amount,
    referenceId,
    description,
    metadata,
    expiresAt = null,
    source = 'ADMIN',
    note,
    offerId,
    grantedById,
    tx: outerTx,
}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
        throw new AppError('Promo amount must be positive.', 400);
    }
    if (!referenceId) throw new AppError('Promo credit needs a referenceId.', 400);

    return inTransaction(outerTx, async (tx) => {
        const wallet = await getOrCreateWallet(userId, tx);
        const already = await tx.walletTransaction.findFirst({
            where: { referenceId, type: 'ADJUST', status: 'SUCCESS' },
        });
        if (already) return { wallet, transaction: already, duplicate: true };

        const updated = await tx.wallet.update({
            where: { id: wallet.id },
            data: { promoBalance: { increment: value } },
        });
        const grant = await recordPromoGrant(tx, {
            userId, amount: value, referenceId, expiresAt, source, note: note ?? description, offerId, grantedById,
        });
        const transaction = await tx.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'ADJUST',
                status: 'SUCCESS',
                amount: value,
                balanceAfter: updated.balance,
                description,
                referenceId,
                provider: 'PROMO',
                metadata: {
                    ...(metadata || {}),
                    promo: true,
                    grantId: grant.id,
                    ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
                },
            },
        });
        return { wallet: updated, transaction, grant, duplicate: false };
    });
}

export async function refundDebit({ txId, reason }) {
    return prisma.$transaction(async (tx) => {
        const row = await tx.walletTransaction.findUnique({ where: { id: txId } });
        if (!row) throw new AppError('Transaction not found.', 404);
        if (row.status === 'SUCCESS' && row.type === 'WITHDRAW') {
            // already finalized as success — do not auto-refund
            throw new AppError('Cannot reverse a completed withdrawal.', 400);
        }

        // Claim the row first so two refunds of the same debit cannot both credit.
        const claimed = await tx.walletTransaction.updateMany({
            where: { id: txId, status: { notIn: ['CANCELLED', 'FAILED'] } },
            data: { status: 'FAILED', description: reason || row.description },
        });
        if (claimed.count === 0) {
            return tx.walletTransaction.findUnique({ where: { id: txId } });
        }

        const wallet = await tx.wallet.update({
            where: { id: row.walletId },
            data: { balance: { increment: row.amount } },
        });

        return tx.walletTransaction.update({
            where: { id: txId },
            data: { balanceAfter: wallet.balance },
        });
    });
}

export async function markWithdrawSuccess(txId, metadata) {
    return prisma.walletTransaction.update({
        where: { id: txId },
        data: {
            status: 'SUCCESS',
            ...(metadata ? { metadata } : {}),
        },
    });
}
