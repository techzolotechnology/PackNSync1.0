import { describe, it, expect, afterEach } from 'vitest';
import { hostShareOf, platformFeePercent, priceWithFee } from './commission.js';

describe('commission', () => {
    afterEach(() => { delete process.env.PLATFORM_FEE_PERCENT; });

    it('adds 2% on top of the host price by default', () => {
        expect(priceWithFee(6000)).toEqual({ hostAmount: 6000, platformFee: 120, totalPrice: 6120, feePercent: 2 });
    });

    it('rounds to paise', () => {
        expect(priceWithFee(1999.99)).toMatchObject({ platformFee: 40, totalPrice: 2039.99 });
    });

    it('is configurable but bounded', () => {
        process.env.PLATFORM_FEE_PERCENT = '5';
        expect(platformFeePercent()).toBe(5);
        process.env.PLATFORM_FEE_PERCENT = '90';
        expect(platformFeePercent()).toBe(2);
    });

    it('treats pre-commission bookings as all host money', () => {
        expect(hostShareOf({ totalPrice: 3000, hostAmount: null })).toBe(3000);
        expect(hostShareOf({ totalPrice: 3060, hostAmount: 3000 })).toBe(3000);
    });
});
