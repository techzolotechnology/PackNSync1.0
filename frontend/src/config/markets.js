/**
 * Countries PickAndSync can operate rentals in, and money formatting.
 *
 * Only India is live today: payments (Cashfree), KYC (Aadhaar/DL) and the
 * wallet are India-only. To open a new market, flip `rentalsLive` here AND add
 * the country to RENTAL_COUNTRIES on the backend (see backend/src/utils/markets.js),
 * then add a payment provider and KYC flow for that country.
 */
export const MARKETS = [
    { code: 'IN', name: 'India', currency: 'INR', locale: 'en-IN', rentalsLive: true },
    { code: 'AE', name: 'United Arab Emirates', currency: 'AED', locale: 'en-AE', rentalsLive: false },
    { code: 'TH', name: 'Thailand', currency: 'THB', locale: 'en-TH', rentalsLive: false },
    { code: 'ID', name: 'Indonesia', currency: 'IDR', locale: 'en-ID', rentalsLive: false },
    { code: 'SG', name: 'Singapore', currency: 'SGD', locale: 'en-SG', rentalsLive: false },
    { code: 'MY', name: 'Malaysia', currency: 'MYR', locale: 'en-MY', rentalsLive: false },
    { code: 'VN', name: 'Vietnam', currency: 'VND', locale: 'en-VN', rentalsLive: false },
    { code: 'LK', name: 'Sri Lanka', currency: 'LKR', locale: 'en-LK', rentalsLive: false },
    { code: 'NP', name: 'Nepal', currency: 'NPR', locale: 'en-NP', rentalsLive: false },
];

export const DEFAULT_CURRENCY = 'INR';

const LOCALE_BY_CURRENCY = Object.fromEntries(MARKETS.map((m) => [m.currency, m.locale]));

/**
 * Format an amount in its currency, e.g. formatMoney(2500) -> "₹2,500",
 * formatMoney(120, 'AED') -> "AED 120". Falls back to INR for missing codes.
 */
export function formatMoney(amount, currency = DEFAULT_CURRENCY) {
    const code = String(currency || DEFAULT_CURRENCY).toUpperCase();
    const value = Number(amount) || 0;
    try {
        return new Intl.NumberFormat(LOCALE_BY_CURRENCY[code] || 'en-IN', {
            style: 'currency',
            currency: code,
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${code} ${Math.round(value).toLocaleString('en-IN')}`;
    }
}
