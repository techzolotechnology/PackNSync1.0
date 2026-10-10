import { prisma } from './prisma.js';
import { AppError } from './AppError.js';
import { round2 } from './commission.js';
import { AUDIENCES } from './audiences.js';
import { parsePromoExpiry, MAX_PROMO_EXPIRY_DAYS } from './promoGrants.js';

export const OFFER_KINDS = ['CREDIT', 'DISCOUNT'];
export const OFFER_AUDIENCES = [...AUDIENCES, 'SELECTED'];
export const MAX_CREDIT_PER_PERSON = 5000;
export const MAX_SELECTED_PEOPLE = 500;
const MAX_FLAT_DISCOUNT = 10000;
const MAX_PERCENT_DISCOUNT = 90;
const MAX_USES_PER_PERSON = 10;

/** Upper limit on credit one offer can hand out in total (all recipients together). */
export function maxOfferCreditTotal() {
    const value = Number(process.env.OFFER_MAX_TOTAL_CREDIT_INR ?? 200000);
    return Number.isFinite(value) && value > 0 ? value : 200000;
}

const optionalNumber = (value) => (value === undefined || value === null || value === '' ? null : Number(value));

/** Validate an admin's offer form. Returns the fields to store, or throws a 400 with a plain message. */
export function readOfferInput(body = {}, now = new Date()) {
    const kind = String(body.kind || '').toUpperCase();
    if (!OFFER_KINDS.includes(kind)) throw new AppError('Choose whether the offer is a discount or a credit.', 400);

    const title = String(body.title || '').trim();
    const message = String(body.message || '').trim();
    if (title.length < 3 || title.length > 80) throw new AppError('Title must be 3–80 characters.', 400);
    if (message.length < 5 || message.length > 500) throw new AppError('Message must be 5–500 characters.', 400);

    const audience = String(body.audience || 'ALL').toUpperCase();
    if (!OFFER_AUDIENCES.includes(audience)) throw new AppError('Choose who gets the offer.', 400);
    const city = audience === 'CITY' ? String(body.city || '').trim().slice(0, 80) : null;
    if (audience === 'CITY' && city.length < 2) throw new AppError('Enter a city.', 400);
    let userIds = [];
    if (audience === 'SELECTED') {
        userIds = [...new Set((Array.isArray(body.userIds) ? body.userIds : []).map(String))];
        if (!userIds.length) throw new AppError('Select at least one person.', 400);
        if (userIds.length > MAX_SELECTED_PEOPLE) throw new AppError(`Select at most ${MAX_SELECTED_PEOPLE} people.`, 400);
    }

    const base = { kind, title, message, audience, city };

    if (kind === 'CREDIT') {
        const creditAmount = Number(body.creditAmount);
        if (!Number.isFinite(creditAmount) || creditAmount < 1 || creditAmount > MAX_CREDIT_PER_PERSON) {
            throw new AppError(`Credit per person must be between ₹1 and ₹${MAX_CREDIT_PER_PERSON}.`, 400);
        }
        return {
            data: { ...base, creditAmount: round2(creditAmount), creditExpiresAt: parsePromoExpiry(body.creditExpiresAt, now) },
            userIds,
        };
    }

    const discountType = String(body.discountType || '').toUpperCase();
    if (!['PERCENT', 'FLAT'].includes(discountType)) throw new AppError('Choose a percentage or a fixed ₹ discount.', 400);
    const discountValue = Number(body.discountValue);
    if (discountType === 'PERCENT' && !(discountValue >= 1 && discountValue <= MAX_PERCENT_DISCOUNT)) {
        throw new AppError(`A percentage discount must be between 1% and ${MAX_PERCENT_DISCOUNT}%.`, 400);
    }
    if (discountType === 'FLAT' && !(discountValue >= 1 && discountValue <= MAX_FLAT_DISCOUNT)) {
        throw new AppError(`A fixed discount must be between ₹1 and ₹${MAX_FLAT_DISCOUNT}.`, 400);
    }
    const maxDiscount = discountType === 'PERCENT' ? optionalNumber(body.maxDiscount) : null;
    if (maxDiscount !== null && !(maxDiscount >= 1 && maxDiscount <= MAX_FLAT_DISCOUNT)) {
        throw new AppError(`Maximum discount must be between ₹1 and ₹${MAX_FLAT_DISCOUNT}.`, 400);
    }
    const minBookingAmount = optionalNumber(body.minBookingAmount);
    if (minBookingAmount !== null && !(minBookingAmount >= 0)) throw new AppError('Minimum booking amount cannot be negative.', 400);
    const appliesTo = String(body.appliesTo || 'ALL').toUpperCase();
    if (!['ALL', 'CAR', 'BIKE'].includes(appliesTo)) throw new AppError('Choose cars, bikes or both.', 400);
    const usesPerUser = Number(body.usesPerUser ?? 1);
    if (!Number.isInteger(usesPerUser) || usesPerUser < 1 || usesPerUser > MAX_USES_PER_PERSON) {
        throw new AppError(`Uses per person must be a whole number from 1 to ${MAX_USES_PER_PERSON}.`, 400);
    }
    const validUntil = parsePromoExpiry(body.validUntil, now);
    if (!validUntil) throw new AppError(`Set an end date for the discount (within ${MAX_PROMO_EXPIRY_DAYS} days).`, 400);

    return {
        data: {
            ...base,
            discountType,
            discountValue: round2(discountValue),
            maxDiscount: maxDiscount === null ? null : round2(maxDiscount),
            minBookingAmount: minBookingAmount === null ? null : round2(minBookingAmount),
            appliesTo,
            usesPerUser,
            validUntil,
        },
        userIds,
    };
}

/** Bikes and scooters share the BIKE offers; everything else is a CAR. */
export function vehicleKind(vehicleType) {
    return ['BIKE', 'SCOOTER'].includes(String(vehicleType || '').toUpperCase()) ? 'BIKE' : 'CAR';
}

/**
 * Discount for a booking total. A booking always costs at least ₹1, so a
 * discount never makes it free (a free booking has no payment to refund).
 */
export function discountFor(offer, amount) {
    const total = round2(amount);
    if (!(total > 1)) return 0;
    if (offer.minBookingAmount && total < offer.minBookingAmount) return 0;
    let discount = offer.discountType === 'PERCENT' ? (total * offer.discountValue) / 100 : offer.discountValue;
    if (offer.maxDiscount) discount = Math.min(discount, offer.maxDiscount);
    return round2(Math.max(0, Math.min(discount, total - 1)));
}

/** True when the offer is still running for this vehicle kind. */
function offerApplies(offer, kind, now) {
    return offer.kind === 'DISCOUNT'
        && offer.status === 'ACTIVE'
        && (!offer.validUntil || new Date(offer.validUntil) > now)
        && (offer.appliesTo === 'ALL' || offer.appliesTo === kind);
}

/**
 * The biggest discount this person can use on a booking of `amount` for a
 * `vehicleType`, with the redemption number to record, or null.
 */
export async function bestDiscountFor({ userId, amount, vehicleType, now = new Date() }, client = prisma) {
    const kind = vehicleKind(vehicleType);
    const offers = await client.offer.findMany({
        where: {
            kind: 'DISCOUNT',
            status: 'ACTIVE',
            appliesTo: { in: ['ALL', kind] },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
            targets: { some: { userId } },
        },
        include: { _count: { select: { redemptions: { where: { userId } } } } },
    });

    let best = null;
    for (const offer of offers) {
        if (!offerApplies(offer, kind, now)) continue;
        const used = offer._count.redemptions;
        if (used >= offer.usesPerUser) continue;
        const discount = discountFor(offer, amount);
        if (discount <= 0) continue;
        const better = !best || discount > best.discount
            || (discount === best.discount && new Date(offer.validUntil) < new Date(best.offer.validUntil));
        if (better) best = { offer, discount, seq: used + 1 };
    }
    return best;
}

/** Plain-language summary of a discount for users and admins, e.g. "20% off bikes (up to ₹500)". */
export function describeDiscount(offer) {
    const what = offer.appliesTo === 'CAR' ? 'cars' : offer.appliesTo === 'BIKE' ? 'bikes and scooters' : 'any car or bike';
    const amount = offer.discountType === 'PERCENT'
        ? `${offer.discountValue}% off`
        : `₹${Number(offer.discountValue).toLocaleString('en-IN')} off`;
    const parts = [`${amount} ${what}`];
    if (offer.maxDiscount) parts.push(`up to ₹${Number(offer.maxDiscount).toLocaleString('en-IN')}`);
    if (offer.minBookingAmount) parts.push(`on bookings of ₹${Number(offer.minBookingAmount).toLocaleString('en-IN')}+`);
    return parts.join(', ');
}

/** Discount offers this person can still use, for their wallet page. */
export async function myAvailableDiscounts(userId, now = new Date()) {
    const offers = await prisma.offer.findMany({
        where: {
            kind: 'DISCOUNT',
            status: 'ACTIVE',
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
            targets: { some: { userId } },
        },
        include: { _count: { select: { redemptions: { where: { userId } } } } },
        orderBy: { validUntil: 'asc' },
    });
    return offers
        .map((o) => ({
            id: o.id,
            title: o.title,
            message: o.message,
            summary: describeDiscount(o),
            appliesTo: o.appliesTo,
            validUntil: o.validUntil,
            usesLeft: Math.max(0, o.usesPerUser - o._count.redemptions),
        }))
        .filter((o) => o.usesLeft > 0);
}
