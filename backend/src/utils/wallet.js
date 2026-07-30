import { prisma } from './prisma.js';
import { AppError } from './AppError.js';

export async function getOrCreateWallet(userId, tx = prisma) {
    const existing = await tx.wallet.findUnique({ where: { userId } });
    if (existing) return existing;
    return tx.wallet.create({
        data: { userId, balance: 0, currency: 'INR' },
    });
}

/**
 * Credit wallet after successful top-up / refund. Idempotent on referenceId + SUCCESS TOPUP/REFUND.
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
}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
        throw new AppError('Credit amount must be positive.', 400);
    }

    return prisma.$transaction(async (tx) => {
        if (referenceId) {
            const already = await tx.walletTransaction.findFirst({
                where: {
                    referenceId,
                    status: 'SUCCESS',
                    type: { in: ['TOPUP', 'REFUND', 'ADJUST'] },
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
                    status: 'SUCCESS',
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
}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
        throw new AppError('Debit amount must be positive.', 400);
    }

    return prisma.$transaction(async (tx) => {
        if (referenceId && type === 'SPEND') {
            const already = await tx.walletTransaction.findFirst({
                where: { referenceId, type: 'SPEND', status: 'SUCCESS' },
            });
            if (already) {
                const wallet = await getOrCreateWallet(userId, tx);
                return { wallet, transaction: already, duplicate: true };
            }
        }

        const wallet = await getOrCreateWallet(userId, tx);
        if (wallet.balance < value) {
            throw new AppError('Insufficient wallet balance.', 400);
        }

        const updated = await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: value } },
        });

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
                metadata,
            },
        });

        return { wallet: updated, transaction, duplicate: false };
    });
}

export async function refundDebit({ txId, reason }) {
    return prisma.$transaction(async (tx) => {
        const row = await tx.walletTransaction.findUnique({ where: { id: txId } });
        if (!row) throw new AppError('Transaction not found.', 404);
        if (row.status === 'CANCELLED' || row.status === 'FAILED') {
            return row;
        }
        if (row.status === 'SUCCESS' && row.type === 'WITHDRAW') {
            // already finalized as success — do not auto-refund
            throw new AppError('Cannot reverse a completed withdrawal.', 400);
        }

        const wallet = await tx.wallet.update({
            where: { id: row.walletId },
            data: { balance: { increment: row.amount } },
        });

        const updated = await tx.walletTransaction.update({
            where: { id: txId },
            data: {
                status: 'FAILED',
                description: reason || row.description,
                balanceAfter: wallet.balance,
            },
        });

        return updated;
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
