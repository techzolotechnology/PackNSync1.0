import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { prisma } from './prisma.js';
import { premiumAccess } from './premiumAccess.js';
import { AppError } from './AppError.js';

const COOKIE = 'pns_ai_chat';
const DAY_MS = 86_400_000;
const LEASE_MS = 60_000;
const signature = (value) => createHmac('sha256', process.env.JWT_SECRET).update(value).digest('hex');

function guestId(req) {
    const [id, mac, extra] = String(req.cookies?.[COOKIE] || '').split('.');
    if (extra || !/^[a-f0-9-]{36}$/.test(id || '') || !/^[a-f0-9]{64}$/.test(mac || '')) return null;
    return timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(id), 'hex')) ? id : null;
}

export async function aiIdentity(req, res) {
    if (req.user?.isBanned) throw new AppError('Your account has been suspended.', 403);
    if (!req.user && req.headers.authorization?.startsWith('Bearer ')) {
        throw new AppError('Your sign-in expired. Sign in again to open AI chat.', 401);
    }
    if (req.user) {
        const subscription = await prisma.premiumSubscription.findUnique({
            where: { userId: req.user.id }, select: { status: true, currentPeriodEndsAt: true },
        });
        const premium = premiumAccess(subscription).isPremium;
        return { ownerKey: `user:${req.user.id}`, userId: req.user.id, tier: premium ? 'premium' : 'account', limit: premium ? 25 : 10 };
    }

    let id = guestId(req);
    if (!id) {
        id = randomUUID();
        const production = process.env.NODE_ENV === 'production';
        res.cookie(COOKIE, `${id}.${signature(id)}`, {
            httpOnly: true, secure: production, sameSite: 'lax', path: '/api', maxAge: 90 * DAY_MS,
        });
    }
    return { ownerKey: `guest:${id}`, userId: null, tier: 'guest', limit: 5 };
}

export function chatContact(input) {
    const displayName = typeof input?.name === 'string' ? input.name.trim() : '';
    let phoneNumber = typeof input?.mobile === 'string' ? input.mobile.trim().replace(/[\s()-]/g, '') : '';
    if (/^[6-9]\d{9}$/.test(phoneNumber)) phoneNumber = `+91${phoneNumber}`;
    if (displayName.length < 2 || displayName.length > 80 || !/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
        throw new AppError('Enter your name and a valid mobile number. For numbers outside India, include the country code.', 400);
    }
    if (input.consent !== true) throw new AppError('Confirm that you agree to save this chat and contact information.', 400);
    return { displayName, phoneNumber };
}

export function aiLimitError(limit) {
    return new AppError(`You’ve used all ${limit} AI messages for today. Your limit resets at midnight IST.`, 429, 'AI_LIMIT_REACHED');
}

export function usageDay(now = Date.now()) {
    return new Date(Math.floor((now + 19_800_000) / DAY_MS) * DAY_MS);
}

export async function aiQuota(identity) {
    const day = usageDay();
    const row = await prisma.exploreAiUsage.findUnique({ where: { ownerKey_day: { ownerKey: identity.ownerKey, day } } });
    return {
        tier: identity.tier, limit: identity.limit,
        remaining: Math.max(0, identity.limit - (row?.used || 0)),
        resetsAt: new Date(day.getTime() + DAY_MS - 19_800_000).toISOString(),
    };
}

export const aiChatMessage = (role, content, fallbackUrl) => ({
    id: randomUUID(), role, content, createdAt: new Date().toISOString(), ...(fallbackUrl ? { fallbackUrl } : {}),
});

export function publicAiChat(row) {
    if (!row) return null;
    return { id: row.id, messages: row.messages, intent: row.searchIntent };
}

export async function reserveAiTurn(identity, chatId, kind) {
    const now = new Date();
    const lease = randomUUID();
    return prisma.$transaction(async (tx) => {
        const where = { id: chatId, ownerKey: identity.ownerKey, kind };
        const row = await tx.exploreAiChat.findFirst({ where });
        if (!row) throw new AppError('Open or start your own AI chat first.', 404);
        const active = await tx.exploreAiChat.updateMany({
            where: { ...where, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
            data: { lease, leaseUntil: new Date(now.getTime() + LEASE_MS) },
        });
        if (!active.count) throw new AppError('This chat is already answering. Try again in a moment.', 409);
        const day = usageDay(now.getTime());
        const counted = await tx.$executeRaw`
            INSERT INTO "ExploreAiUsage" ("ownerKey", "day", "used") VALUES (${identity.ownerKey}, ${day}::date, 1)
            ON CONFLICT ("ownerKey", "day") DO UPDATE SET "used" = "ExploreAiUsage"."used" + 1
            WHERE "ExploreAiUsage"."used" < ${identity.limit}
        `;
        if (!counted) throw aiLimitError(identity.limit);
        const claimed = await tx.exploreAiChat.findFirstOrThrow({ where: { ...where, lease } });
        return { ...claimed, day };
    });
}

export async function finishAiTurn(turn, messages, updates = {}) {
    const data = { ...updates, messages: [...turn.messages, ...messages], lease: null, leaseUntil: null };
    const finished = await prisma.exploreAiChat.updateMany({ where: { id: turn.id, lease: turn.lease }, data });
    if (!finished.count) throw new AppError('This request expired. Send your message again.', 409);
    return { ...turn, ...data };
}

export async function releaseAiTurn(turn) {
    await prisma.$transaction(async (tx) => {
        const released = await tx.exploreAiChat.updateMany({
            where: { id: turn.id, lease: turn.lease }, data: { lease: null, leaseUntil: null },
        });
        if (released.count) {
            await tx.exploreAiUsage.updateMany({
                where: { ownerKey: turn.ownerKey, day: turn.day, used: { gt: 0 } }, data: { used: { decrement: 1 } },
            });
        }
    });
}
