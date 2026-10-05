import { AppError } from './AppError.js';

/** ISO country -> currency for markets PickAndSync knows about. */
export const MARKET_CURRENCY = {
    IN: 'INR',
    AE: 'AED',
    TH: 'THB',
    ID: 'IDR',
    SG: 'SGD',
    MY: 'MYR',
    VN: 'VND',
    LK: 'LKR',
    NP: 'NPR',
};

/**
 * Countries where hosts may list vehicles. India only by default because
 * payments (Cashfree), the wallet and KYC (Aadhaar/DL) are India-only.
 * Opening a market: add a payment provider + KYC for it, then set e.g.
 * RENTAL_COUNTRIES=IN,AE.
 */
export function rentalCountries() {
    const raw = process.env.RENTAL_COUNTRIES || 'IN';
    return raw.split(',').map((c) => c.trim().toUpperCase()).filter((c) => MARKET_CURRENCY[c]);
}

/** Resolve and validate a listing's country; returns { country, currency }. */
export function resolveListingMarket(country) {
    const code = String(country || 'IN').trim().toUpperCase();
    if (!rentalCountries().includes(code)) {
        throw new AppError(`Rentals are not available in ${code} yet.`, 400);
    }
    return { country: code, currency: MARKET_CURRENCY[code] };
}
