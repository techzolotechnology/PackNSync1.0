import { prisma } from './prisma.js';
import { AppError } from './AppError.js';
import { round2 } from './commission.js';
import { notifyUser } from './notify.js';

/**
 * Promo credit is tracked in blocks (promo_grants), each with an optional
 * expiry; wallets.promoBalance stays the spendable total.
 *
 * Locking order is always: wallet row first, then grant rows. Spends lock the
 * wallet through their compare-and-swap update, expiry and refunds through
 * SELECT … FOR UPDATE, so the two can never deadlock or spend the same credit.
 */

export const MAX_PROMO_EXPIRY_DAYS = 365;
const REFUND_GRACE_DAYS = 7;
export const EXPIRY_REMINDER_HOURS = 48;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Optional expiry from an admin form. A date-only value ("2026-12-31") means
 * the end of that day in India. Must be in the future and within a year.
 */
export function parsePromoExpiry(value, now = new Date()) {
    if (value === undefined || value === null || value === '') return null;
    const raw = String(value).trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T23:59:59+05:30`) : new Date(raw);
    if (Number.isNaN(date.getTime())) throw new AppError('Expiry date is not a valid date.', 400);
    if (date <= now) throw new AppError('Expiry date must be in the future.', 400);
    if (date.getTime() - now.getTime() > MAX_PROMO_EXPIRY_DAYS * DAY_MS) {
        throw new AppError(`Expiry can be at most ${MAX_PROMO_EXPIRY_DAYS} days away.`, 400);
    }
    return date;
}

const expiryTime = (g) => (g.expiresAt ? new Date(g.expiresAt).getTime() : Number.POSITIVE_INFINITY);

/** Credit closest to expiring is spent first; credit without expiry last; oldest first otherwise. */
export function spendOrder(grants) {
    return [...grants].sort((a, b) => (expiryTime(a) - expiryTime(b))
        || (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
}

/** Which grants pay for `amount` of promo, as [{ id, amount }]. May cover less if grants fall short. */
export function planPromoSpend(grants, amount) {
    let left = round2(amount);
    const plan = [];
    for (const g of spendOrder(grants)) {
        if (left <= 0) break;
        const take = round2(Math.min(Number(g.remaining) || 0, left));
        if (take > 0) {
            plan.push({ id: g.id, amount: take });
            left = round2(left - take);
        }
    }
    return plan;
}

async function lockWallet(tx, userId) {
    const rows = await tx.$queryRaw`SELECT "id", "balance", "promoBalance" FROM "wallets" WHERE "userId" = ${userId} FOR UPDATE`;
    return rows[0] || null;
}

/** Create the grant row for a promo credit (called inside creditPromo's transaction). */
export async function recordPromoGrant(tx, { userId, amount, referenceId, expiresAt = null, source, note, offerId, grantedById }) {
    return tx.promoGrant.create({
        data: {
            userId,
            amount,
            remaining: amount,
            expiresAt,
            source,
            note: note ? String(note).slice(0, 200) : null,
            offerId: offerId || null,
            grantedById: grantedById || null,
            referenceId,
        },
    });
}

/**
 * Take `amount` of promo from the user's grants. Runs inside a spend's
 * transaction after its wallet update, which already holds the wallet lock.
 */
export async function consumePromoGrants(tx, userId, amount) {
    if (!(amount > 0)) return [];
    const grants = await tx.promoGrant.findMany({
        where: { userId, remaining: { gt: 0 }, expiredAt: null },
        select: { id: true, remaining: true, expiresAt: true, createdAt: true },
    });
    const plan = planPromoSpend(grants, amount);
    for (const part of plan) {
        const updated = await tx.promoGrant.updateMany({
            where: { id: part.id, remaining: { gte: part.amount } },
            data: { remaining: { decrement: part.amount } },
        });
        if (updated.count !== 1) throw new AppError('Wallet is busy. Please try again.', 409);
    }
    return plan;
}

/** Remove one grant's unspent credit from the wallet. Caller holds the wallet lock. */
async function expireGrantLocked(tx, wallet, grant, now) {
    const take = round2(Math.min(grant.remaining, Math.max(0, wallet.promoBalance)));
    await tx.promoGrant.update({ where: { id: grant.id }, data: { remaining: 0, expiredAt: now } });
    if (take <= 0) return 0;
    const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { promoBalance: { decrement: take } },
    });
    wallet.promoBalance = updated.promoBalance;
    await tx.walletTransaction.create({
        data: {
            walletId: wallet.id,
            type: 'EXPIRE',
            status: 'SUCCESS',
            amount: take,
            balanceAfter: updated.balance,
            description: `Promo credit expired${grant.note ? ` (${grant.note})` : ''}`,
            referenceId: `expire_${grant.id}`,
            provider: 'PROMO',
            metadata: { promo: true, grantId: grant.id },
        },
    });
    return take;
}

/** Expire this user's overdue credit inside an open transaction (e.g. before a spend). */
export async function expireDueGrantsForUser(tx, userId, now = new Date()) {
    const due = await tx.promoGrant.count({
        where: { userId, remaining: { gt: 0 }, expiredAt: null, expiresAt: { lte: now } },
    });
    if (!due) return 0;
    const wallet = await lockWallet(tx, userId);
    if (!wallet) return 0;
    const grants = await tx.promoGrant.findMany({
        where: { userId, remaining: { gt: 0 }, expiredAt: null, expiresAt: { lte: now } },
    });
    let total = 0;
    for (const grant of grants) total += await expireGrantLocked(tx, wallet, grant, now);
    return round2(total);
}

/** Background sweep: expire overdue credit for everyone and tell each person. */
export async function expireDuePromoGrants({ limit = 200, now = new Date() } = {}) {
    const due = await prisma.promoGrant.findMany({
        where: { remaining: { gt: 0 }, expiredAt: null, expiresAt: { lte: now } },
        select: { userId: true },
        distinct: ['userId'],
        take: limit,
    });
    let expired = 0;
    for (const { userId } of due) {
        try {
            const amount = await prisma.$transaction((tx) => expireDueGrantsForUser(tx, userId, now));
            if (amount > 0) {
                expired += 1;
                await notifyUser({
                    userId,
                    type: 'SYSTEM',
                    title: 'Promo credit expired',
                    body: `₹${amount.toLocaleString('en-IN')} of unused promo credit reached its expiry date and was removed from your wallet.`,
                    data: { promo: true },
                });
            }
        } catch (err) {
            console.error('[promo] expiry failed for user', userId, err.message || err);
        }
    }
    return { usersChecked: due.length, usersExpired: expired };
}

/** Background sweep: one reminder per grant, EXPIRY_REMINDER_HOURS before it expires. */
export async function remindExpiringPromoGrants({ limit = 200, now = new Date() } = {}) {
    const soon = new Date(now.getTime() + EXPIRY_REMINDER_HOURS * 60 * 60 * 1000);
    const grants = await prisma.promoGrant.findMany({
        where: { remaining: { gt: 0 }, expiredAt: null, reminderSentAt: null, expiresAt: { gt: now, lte: soon } },
        take: limit,
    });
    let sent = 0;
    for (const grant of grants) {
        // Claim first so two instances never send the same reminder.
        const claimed = await prisma.promoGrant.updateMany({
            where: { id: grant.id, reminderSentAt: null },
            data: { reminderSentAt: now },
        });
        if (claimed.count !== 1) continue;
        const when = new Date(grant.expiresAt).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
        });
        await notifyUser({
            userId: grant.userId,
            type: 'SYSTEM',
            title: 'Your promo credit expires soon',
            body: `₹${round2(grant.remaining).toLocaleString('en-IN')} of promo credit expires on ${when}. Use it on a car or bike rental before then.`,
            data: { promo: true, grantId: grant.id },
        });
        sent += 1;
    }
    return { reminded: sent };
}

/**
 * Give back promo credit that paid for a refunded booking, to the same grants
 * it came from. A grant that has expired meanwhile gets REFUND_GRACE_DAYS more.
 * Idempotent on referenceId. Runs inside the refund's transaction.
 */
export async function returnPromo(tx, { userId, amount, grants = [], referenceId, description, metadata, now = new Date() }) {
    const value = round2(amount);
    if (!(value > 0)) return null;
    const already = await tx.walletTransaction.findFirst({ where: { referenceId, type: 'ADJUST', status: 'SUCCESS' } });
    if (already) return already;

    let wallet = await lockWallet(tx, userId);
    if (!wallet) {
        wallet = await tx.wallet.create({ data: { userId } });
    }

    let restored = 0;
    for (const part of Array.isArray(grants) ? grants : []) {
        const take = round2(Math.min(Number(part.amount) || 0, value - restored));
        if (take <= 0) break;
        const grant = await tx.promoGrant.findUnique({ where: { id: part.id } });
        if (!grant || grant.userId !== userId) continue;
        const lapsed = grant.expiredAt || (grant.expiresAt && grant.expiresAt <= now);
        await tx.promoGrant.update({
            where: { id: grant.id },
            data: {
                remaining: { increment: take },
                ...(lapsed ? { expiresAt: new Date(now.getTime() + REFUND_GRACE_DAYS * DAY_MS), expiredAt: null, reminderSentAt: null } : {}),
            },
        });
        restored = round2(restored + take);
    }
    const rest = round2(value - restored);
    if (rest > 0) {
        await recordPromoGrant(tx, { userId, amount: rest, referenceId, source: 'REFUND', note: description });
    }

    const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { promoBalance: { increment: value } } });
    return tx.walletTransaction.create({
        data: {
            walletId: wallet.id,
            type: 'ADJUST',
            status: 'SUCCESS',
            amount: value,
            balanceAfter: updated.balance,
            description,
            referenceId,
            provider: 'PROMO',
            metadata: { ...(metadata || {}), promo: true, returned: true },
        },
    });
}

/** Unspent, unexpired credit blocks for display, soonest expiry first. */
export async function activePromoCredits(userId, client = prisma) {
    const grants = await client.promoGrant.findMany({
        where: { userId, remaining: { gt: 0 }, expiredAt: null },
        select: { id: true, amount: true, remaining: true, expiresAt: true, source: true, note: true, createdAt: true },
    });
    return spendOrder(grants);
}
