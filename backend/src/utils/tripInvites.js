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
 * Link to share on WhatsApp etc. With SHARE_BASE_URL set (the go.pickandsync.com
 * Cloudflare Worker) links are short and open instantly: the Worker sends people
 * straight to the website and only fetches the API's preview page for link
 * preview bots. Without it, links point at the API's /share page directly.
 */
export function shareTripUrl(req, tripId, inviteCode = null) {
    const query = inviteCode ? `?invite=${encodeURIComponent(inviteCode)}` : '';
    const shareBase = (process.env.SHARE_BASE_URL || '').trim().replace(/\/+$/, '');
    if (shareBase) return `${shareBase}/t/${encodeURIComponent(tripId)}${query}`;
    return `${apiPublicBase(req)}/share/trips/${tripId}${query}`;
}
