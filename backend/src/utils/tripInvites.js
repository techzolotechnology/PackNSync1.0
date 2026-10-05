import { timingSafeEqual } from 'crypto';
import { prisma } from './prisma.js';

/** True when `code` is the current invite code for the trip. */
export async function isValidTripInvite(tripId, code) {
    if (!tripId || !code) return false;
    const invite = await prisma.tripInvite.findUnique({ where: { tripId } });
    if (!invite) return false;
    const a = Buffer.from(String(invite.code));
    const b = Buffer.from(String(code));
    return a.length === b.length && timingSafeEqual(a, b);
}

export function apiPublicBase(req) {
    if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/$/, '');
    return `${req.protocol}://${req.get('host')}`;
}

/**
 * Link to share on WhatsApp etc. It points at the API's /share page, which
 * serves Open Graph tags for the trip (the static site cannot) and then
 * redirects people to the trip page on the website.
 */
export function shareTripUrl(req, tripId, inviteCode = null) {
    const query = inviteCode ? `?invite=${encodeURIComponent(inviteCode)}` : '';
    return `${apiPublicBase(req)}/share/trips/${tripId}${query}`;
}
