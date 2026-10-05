import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal in-memory stand-in for the Prisma calls the wallet helpers make.
// Conditional updateMany calls are evaluated against current state, which is
// what makes the real queries race-safe.
const db = { wallets: [], txs: [] };
let nextId = 1;

const matches = (row, where = {}) => Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
        if ('gte' in cond) return row[key] >= cond.gte;
        if ('in' in cond) return cond.in.includes(row[key]);
        if ('notIn' in cond) return !cond.notIn.includes(row[key]);
    }
    return row[key] === cond;
});

const applyData = (row, data) => {
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;
        if (value && typeof value === 'object' && 'increment' in value) row[key] += value.increment;
        else if (value && typeof value === 'object' && 'decrement' in value) row[key] -= value.decrement;
        else row[key] = value;
    }
    return row;
};

const client = {
    wallet: {
        upsert: async ({ where, create }) => {
            let w = db.wallets.find((x) => x.userId === where.userId);
            if (!w) { w = { id: `w${nextId++}`, ...create }; db.wallets.push(w); }
            return { ...w };
        },
        findUnique: async ({ where }) => ({ ...db.wallets.find((x) => x.id === where.id) }),
        update: async ({ where, data }) => ({ ...applyData(db.wallets.find((x) => x.id === where.id), data) }),
        updateMany: async ({ where, data }) => {
            const rows = db.wallets.filter((x) => matches(x, where));
            rows.forEach((r) => applyData(r, data));
            return { count: rows.length };
        },
    },
    walletTransaction: {
        findFirst: async ({ where }) => db.txs.find((x) => matches(x, where)) || null,
        findUnique: async ({ where }) => db.txs.find((x) => x.id === where.id) || null,
        create: async ({ data }) => { const t = { id: `t${nextId++}`, ...data }; db.txs.push(t); return { ...t }; },
        update: async ({ where, data }) => ({ ...applyData(db.txs.find((x) => x.id === where.id), data) }),
        updateMany: async ({ where, data }) => {
            const rows = db.txs.filter((x) => matches(x, where));
            rows.forEach((r) => applyData(r, data));
            return { count: rows.length };
        },
    },
};

vi.mock('./prisma.js', () => ({
    prisma: { ...client, $transaction: (fn) => fn(client) },
}));

const { creditWallet, creditPromo, debitWallet, refundDebit } = await import('./wallet.js');

const balanceOf = (userId) => db.wallets.find((w) => w.userId === userId)?.balance ?? 0;
const promoOf = (userId) => db.wallets.find((w) => w.userId === userId)?.promoBalance ?? 0;

describe('wallet helpers', () => {
    beforeEach(() => {
        db.wallets = [];
        db.txs = [];
    });

    it('credits a pending top-up only once when webhook and verify race', async () => {
        await client.wallet.upsert({ where: { userId: 'u1' }, create: { userId: 'u1', balance: 0, promoBalance: 0 } });
        const pending = await client.walletTransaction.create({
            data: { walletId: db.wallets[0].id, type: 'TOPUP', status: 'PENDING', amount: 500, referenceId: 'ord1' },
        });

        const [a, b] = await Promise.all([
            creditWallet({ userId: 'u1', amount: 500, referenceId: 'ord1', txId: pending.id }),
            creditWallet({ userId: 'u1', amount: 500, referenceId: 'ord1', txId: pending.id }),
        ]);

        expect(balanceOf('u1')).toBe(500);
        expect([a.duplicate, b.duplicate].sort()).toEqual([false, true]);
    });

    it('never lets concurrent debits overdraw the balance', async () => {
        await creditWallet({ userId: 'u1', amount: 100, referenceId: 'seed' });

        const results = await Promise.allSettled([
            debitWallet({ userId: 'u1', amount: 80, type: 'WITHDRAW', status: 'PENDING' }),
            debitWallet({ userId: 'u1', amount: 80, type: 'WITHDRAW', status: 'PENDING' }),
        ]);

        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(results.find((r) => r.status === 'rejected').reason.message).toMatch(/Insufficient/);
        expect(balanceOf('u1')).toBe(20);
    });

    it('treats a repeated SPEND reference as a duplicate, not a second charge', async () => {
        await creditWallet({ userId: 'u1', amount: 100, referenceId: 'seed' });

        await debitWallet({ userId: 'u1', amount: 40, referenceId: 'rental_b1' });
        const again = await debitWallet({ userId: 'u1', amount: 40, referenceId: 'rental_b1' });

        expect(again.duplicate).toBe(true);
        expect(balanceOf('u1')).toBe(60);
    });

    it('refunds a failed withdrawal exactly once', async () => {
        await creditWallet({ userId: 'u1', amount: 100, referenceId: 'seed' });
        const { transaction } = await debitWallet({ userId: 'u1', amount: 100, type: 'WITHDRAW', status: 'PENDING' });

        await Promise.all([
            refundDebit({ txId: transaction.id, reason: 'payout failed' }),
            refundDebit({ txId: transaction.id, reason: 'payout failed' }),
        ]);

        expect(balanceOf('u1')).toBe(100);
    });

    it('spends promo credit before cash and records how much promo was used', async () => {
        await creditWallet({ userId: 'u1', amount: 100, referenceId: 'seed' });
        await creditPromo({ userId: 'u1', amount: 30, referenceId: 'referral_x_referee' });

        const { transaction } = await debitWallet({ userId: 'u1', amount: 50, referenceId: 'rental_b2' });

        expect(promoOf('u1')).toBe(0);
        expect(balanceOf('u1')).toBe(80);
        expect(transaction.metadata.promoUsed).toBe(30);
    });

    it('never lets promo credit be withdrawn', async () => {
        await creditPromo({ userId: 'u1', amount: 500, referenceId: 'referral_y_referee' });

        await expect(debitWallet({ userId: 'u1', amount: 100, type: 'WITHDRAW', status: 'PENDING' }))
            .rejects.toThrow(/Insufficient/);
        expect(promoOf('u1')).toBe(500);
    });

    it('grants a promo reward only once per reference', async () => {
        await creditPromo({ userId: 'u1', amount: 100, referenceId: 'referral_z_referrer' });
        const again = await creditPromo({ userId: 'u1', amount: 100, referenceId: 'referral_z_referrer' });

        expect(again.duplicate).toBe(true);
        expect(promoOf('u1')).toBe(100);
    });

    it('rejects non-positive amounts', async () => {
        await expect(creditWallet({ userId: 'u1', amount: 0 })).rejects.toThrow(/positive/);
        await expect(debitWallet({ userId: 'u1', amount: -5 })).rejects.toThrow(/positive/);
    });
});
