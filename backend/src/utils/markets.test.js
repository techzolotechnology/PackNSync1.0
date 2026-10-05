import { describe, it, expect, afterEach } from 'vitest';
import { rentalCountries, resolveListingMarket } from './markets.js';

describe('rental markets', () => {
    afterEach(() => {
        delete process.env.RENTAL_COUNTRIES;
    });

    it('allows only India by default', () => {
        expect(rentalCountries()).toEqual(['IN']);
        expect(resolveListingMarket()).toEqual({ country: 'IN', currency: 'INR' });
        expect(() => resolveListingMarket('AE')).toThrow(/not available/);
    });

    it('opens extra markets via RENTAL_COUNTRIES and derives currency', () => {
        process.env.RENTAL_COUNTRIES = 'IN, ae';
        expect(resolveListingMarket('ae')).toEqual({ country: 'AE', currency: 'AED' });
    });

    it('ignores unknown country codes in RENTAL_COUNTRIES', () => {
        process.env.RENTAL_COUNTRIES = 'IN,XX';
        expect(rentalCountries()).toEqual(['IN']);
    });
});
