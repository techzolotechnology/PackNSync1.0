import { describe, it, expect, vi } from 'vitest';

vi.mock('./prisma.js', () => ({ prisma: {} }));

const { readOfferInput, discountFor, vehicleKind, describeDiscount } = await import('./offers.js');

const NOW = new Date('2026-10-10T06:00:00Z');
const base = { title: 'Diwali rides', message: 'Celebrate with a cheaper trip.', audience: 'ALL' };

describe('readOfferInput', () => {
    it('accepts a credit offer with an optional expiry', () => {
        const { data } = readOfferInput({ ...base, kind: 'credit', creditAmount: '250', creditExpiresAt: '2026-11-30' }, NOW);
        expect(data).toMatchObject({ kind: 'CREDIT', creditAmount: 250, audience: 'ALL' });
        expect(data.creditExpiresAt.toISOString()).toBe('2026-11-30T18:29:59.000Z');
    });

    it('accepts a discount offer and keeps its limits', () => {
        const { data } = readOfferInput({
            ...base, kind: 'DISCOUNT', discountType: 'percent', discountValue: 20, maxDiscount: 500,
            appliesTo: 'bike', usesPerUser: 2, validUntil: '2026-10-20',
        }, NOW);
        expect(data).toMatchObject({ discountType: 'PERCENT', discountValue: 20, maxDiscount: 500, appliesTo: 'BIKE', usesPerUser: 2 });
    });

    it('needs selected people for a SELECTED audience', () => {
        expect(() => readOfferInput({ ...base, kind: 'CREDIT', creditAmount: 100, audience: 'SELECTED', userIds: [] }, NOW))
            .toThrow(/at least one/);
        const { userIds } = readOfferInput({ ...base, kind: 'CREDIT', creditAmount: 100, audience: 'SELECTED', userIds: ['a', 'a', 'b'] }, NOW);
        expect(userIds).toEqual(['a', 'b']);
    });

    it('rejects unsafe values', () => {
        expect(() => readOfferInput({ ...base, kind: 'CREDIT', creditAmount: 6000 }, NOW)).toThrow(/between ₹1 and ₹5000/);
        expect(() => readOfferInput({ ...base, kind: 'DISCOUNT', discountType: 'PERCENT', discountValue: 95, validUntil: '2026-10-20' }, NOW))
            .toThrow(/90%/);
        expect(() => readOfferInput({ ...base, kind: 'DISCOUNT', discountType: 'FLAT', discountValue: 100 }, NOW))
            .toThrow(/end date/);
        expect(() => readOfferInput({ ...base, kind: 'GIFT' }, NOW)).toThrow(/discount or a credit/);
    });
});

describe('discountFor', () => {
    const percent = { discountType: 'PERCENT', discountValue: 20, maxDiscount: 500, minBookingAmount: null };
    const flat = { discountType: 'FLAT', discountValue: 300, maxDiscount: null, minBookingAmount: 1000 };

    it('applies the percentage up to its cap', () => {
        expect(discountFor(percent, 1000)).toBe(200);
        expect(discountFor(percent, 6120)).toBe(500);
    });

    it('needs the minimum booking amount', () => {
        expect(discountFor(flat, 999)).toBe(0);
        expect(discountFor(flat, 1000)).toBe(300);
    });

    it('never makes a booking free', () => {
        expect(discountFor({ ...flat, minBookingAmount: null }, 250)).toBe(249);
    });
});

describe('offer helpers', () => {
    it('groups bikes and scooters together', () => {
        expect(vehicleKind('SCOOTER')).toBe('BIKE');
        expect(vehicleKind('BIKE')).toBe('BIKE');
        expect(vehicleKind('CAR')).toBe('CAR');
    });

    it('describes a discount in plain words', () => {
        expect(describeDiscount({ discountType: 'PERCENT', discountValue: 20, maxDiscount: 500, appliesTo: 'BIKE' }))
            .toBe('20% off bikes and scooters, up to ₹500');
        expect(describeDiscount({ discountType: 'FLAT', discountValue: 300, minBookingAmount: 2000, appliesTo: 'ALL' }))
            .toBe('₹300 off any car or bike, on bookings of ₹2,000+');
    });
});
