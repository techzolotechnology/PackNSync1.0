import { randomBytes } from 'crypto';
import { prisma } from './prisma.js';
import { creditPromo } from './wallet.js';
import { notifyUser } from './notify.js';

/** Promo credit (INR) for both referrer and referee. 0 disables rewards. */
export function referralRewardAmount() {
    const value = Number(process.env.REFERRAL_REWARD_INR ?? 100);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

export function frontendBase() {
    return (process.env.FRONTEND_URL || 'https://pickandsync.com').replace(/\/$/, '');
}

/** Short, URL-safe, unambiguous code (no 0/O/1/I/L). */
export function generateCode(length = 8) {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(length);
    let code = '';
    for (let i = 0; i < length; i += 1) code += alphabet[bytes[i] % alphabet.length];
    return code;
}

/** Return the user's referral code, creating one on first use. */
export async function ensureReferralCode(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
    if (user?.referralCode) return user.referralCode;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = generateCode();
        try {
            // Only set it if still empty, so two concurrent calls agree on one code.
            const updated = await prisma.user.updateMany({
                where: { id: userId, referralCode: null },
                data: { referralCode: code },
            });
            if (updated.count === 1) return code;
            const current = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
            if (current?.referralCode) return current.referralCode;
        } catch (err) {
            if (err.code !== 'P2002') throw err; // code collision: try another
        }
    }
    throw new Error('Could not generate a referral code.');
}

/** Resolve a referral code to the referrer's id (null when invalid). */
export async function findReferrerId(code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(clean)) return null;
    const referrer = await prisma.user.findUnique({ where: { referralCode: clean }, select: { id: true, isBanned: true } });
    return referrer && !referrer.isBanned ? referrer.id : null;
}

/**
 * Reward referrer and referee once the referee completes their first paid
 * booking. Requiring a real paid (KYC-gated) booking keeps fake sign-ups from
 * farming credit. Idempotent: reference ids are unique per referee.
 */
export async function grantReferralRewards(refereeId) {
    const amount = referralRewardAmount();
    if (!amount) return;

    const referee = await prisma.user.findUnique({
        where: { id: refereeId },
        select: { id: true, name: true, referredById: true },
    });
    if (!referee?.referredById || referee.referredById === referee.id) return;

    const paidBookings = await prisma.rentalBooking.count({ where: { renterId: refereeId, status: 'PAID' } });
    if (paidBookings !== 1) return;

    const [forReferee, forReferrer] = await Promise.all([
        creditPromo({
            userId: referee.id,
            amount,
            referenceId: `referral_${referee.id}_referee`,
            description: 'Referral reward: welcome credit',
            metadata: { referrerId: referee.referredById },
        }),
        creditPromo({
            userId: referee.referredById,
            amount,
            referenceId: `referral_${referee.id}_referrer`,
            description: `Referral reward: ${referee.name} made their first booking`,
            metadata: { refereeId: referee.id },
        }),
    ]);

    if (!forReferee.duplicate) {
        await notifyUser({
            userId: referee.id,
            type: 'SYSTEM',
            title: `₹${amount} credit added`,
            body: 'Thanks for booking! Your referral credit is in your wallet for your next trip.',
            data: { referral: true },
        });
    }
    if (!forReferrer.duplicate) {
        await notifyUser({
            userId: referee.referredById,
            type: 'SYSTEM',
            title: `You earned ₹${amount}`,
            body: `${referee.name} made their first booking with your invite. Credit added to your wallet.`,
            data: { referral: true },
        });
    }
}
