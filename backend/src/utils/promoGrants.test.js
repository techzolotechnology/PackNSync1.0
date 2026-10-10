import { describe, it, expect, vi } from 'vitest';

vi.mock('./prisma.js', () => ({ prisma: {} }));

const { parsePromoExpiry, spendOrder, planPromoSpend } = await import('./promoGrants.js');

const NOW = new Date('2026-10-10T06:00:00Z');

describe('parsePromoExpiry', () => {
    it('treats empty as no expiry', () => {
        expect(parsePromoExpiry('', NOW)).toBeNull();
        expect(parsePromoExpiry(undefined, NOW)).toBeNull();
    });

    it('reads a date as the end of that day in India', () => {
        expect(parsePromoExpiry('2026-10-31', NOW).toISOString()).toBe('2026-10-31T18:29:59.000Z');
    });

    it('rejects past, invalid and far-future dates', () => {
        expect(() => parsePromoExpiry('2026-10-01', NOW)).toThrow(/future/);
        expect(() => parsePromoExpiry('not a date', NOW)).toThrow(/valid/);
        expect(() => parsePromoExpiry('2028-01-01', NOW)).toThrow(/365 days/);
    });
});

describe('spending promo credit', () => {
    const grants = [
        { id: 'never', remaining: 100, expiresAt: null, createdAt: '2026-09-01' },
        { id: 'late', remaining: 50, expiresAt: '2026-12-01', createdAt: '2026-09-02' },
        { id: 'soon', remaining: 30, expiresAt: '2026-10-15', createdAt: '2026-10-01' },
    ];

    it('uses credit closest to expiry first and non-expiring credit last', () => {
        expect(spendOrder(grants).map((g) => g.id)).toEqual(['soon', 'late', 'never']);
    });

    it('splits a spend across grants in that order', () => {
        expect(planPromoSpend(grants, 60)).toEqual([{ id: 'soon', amount: 30 }, { id: 'late', amount: 30 }]);
        expect(planPromoSpend(grants, 180)).toEqual([
            { id: 'soon', amount: 30 }, { id: 'late', amount: 50 }, { id: 'never', amount: 100 },
        ]);
    });

    it('covers only what the grants hold', () => {
        expect(planPromoSpend(grants, 500).reduce((s, p) => s + p.amount, 0)).toBe(180);
        expect(planPromoSpend(grants, 0)).toEqual([]);
    });
});
