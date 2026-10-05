/** Round to paise. */
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * PickAndSync commission, added on top of the host's price (default 2%).
 * The host always receives their full price; the renter pays price + fee.
 */
export function platformFeePercent() {
    const value = Number(process.env.PLATFORM_FEE_PERCENT ?? 2);
    return Number.isFinite(value) && value >= 0 && value <= 30 ? value : 2;
}

/** Split a host price into what the renter pays and what PickAndSync keeps. */
export function priceWithFee(hostAmount, percent = platformFeePercent()) {
    const host = round2(hostAmount);
    const platformFee = round2((host * percent) / 100);
    return { hostAmount: host, platformFee, totalPrice: round2(host + platformFee), feePercent: percent };
}

/** Hours after the trip ends before a host's earning becomes withdrawable. */
export function earningReleaseHours() {
    const value = Number(process.env.HOST_EARNING_RELEASE_HOURS ?? 24);
    return Number.isFinite(value) && value >= 0 && value <= 24 * 30 ? value : 24;
}

/** Host's share of a booking; older bookings (pre-commission) were all host money. */
export function hostShareOf(booking) {
    return booking.hostAmount ?? booking.totalPrice;
}
