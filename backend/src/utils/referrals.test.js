import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaMock = {
    user: { findUnique: vi.fn() },
    rentalBooking: { count: vi.fn() },
};
vi.mock('./prisma.js', () => ({ prisma: prismaMock }));
vi.mock('./notify.js', () => ({ notifyUser: vi.fn() }));
const creditPromo = vi.fn(async () => ({ duplicate: false }));
vi.mock('./wallet.js', () => ({ creditPromo }));

const { generateCode, grantReferralRewards, referralRewardAmount, findReferrerId } = await import('./referrals.js');

describe('referrals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.REFERRAL_REWARD_INR;
    });

    it('generates unambiguous codes of the requested length', () => {
        const code = generateCode(10);
        expect(code).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    });

    it('defaults to a ₹100 reward and can be disabled', () => {
        expect(referralRewardAmount()).toBe(100);
        process.env.REFERRAL_REWARD_INR = '0';
        expect(referralRewardAmount()).toBe(0);
    });

    it('rewards both people on the referee\'s first paid booking', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: 'friend', name: 'Asha', referredById: 'host' });
        prismaMock.rentalBooking.count.mockResolvedValue(1);

        await grantReferralRewards('friend');

        expect(creditPromo).toHaveBeenCalledTimes(2);
        expect(creditPromo).toHaveBeenCalledWith(expect.objectContaining({ userId: 'friend', amount: 100, referenceId: 'referral_friend_referee' }));
        expect(creditPromo).toHaveBeenCalledWith(expect.objectContaining({ userId: 'host', amount: 100, referenceId: 'referral_friend_referrer' }));
    });

    it('does not reward on later bookings or without a referrer', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: 'friend', name: 'Asha', referredById: 'host' });
        prismaMock.rentalBooking.count.mockResolvedValue(2);
        await grantReferralRewards('friend');

        prismaMock.user.findUnique.mockResolvedValue({ id: 'solo', name: 'Ravi', referredById: null });
        prismaMock.rentalBooking.count.mockResolvedValue(1);
        await grantReferralRewards('solo');

        expect(creditPromo).not.toHaveBeenCalled();
    });

    it('ignores malformed or banned referral codes', async () => {
        expect(await findReferrerId('<script>')).toBeNull();
        prismaMock.user.findUnique.mockResolvedValue({ id: 'bad', isBanned: true });
        expect(await findReferrerId('ABCD2345')).toBeNull();
        prismaMock.user.findUnique.mockResolvedValue({ id: 'good', isBanned: false });
        expect(await findReferrerId('abcd2345')).toBe('good');
    });
});
