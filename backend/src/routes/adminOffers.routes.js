import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { creditPromo } from '../utils/wallet.js';
import { logAdminAction } from '../utils/audit.js';
import { audienceWhere } from '../utils/audiences.js';
import { round2 } from '../utils/commission.js';
import {
    readOfferInput, describeDiscount, maxOfferCreditTotal, OFFER_AUDIENCES, MAX_SELECTED_PEOPLE,
} from '../utils/offers.js';

/** Admin offers: rental discounts and wallet credits, sent to everyone, a segment or chosen people. */
export const adminOffersRouter = Router();

const PARALLEL_GRANTS = 10;

/** Users an offer goes to: active, non-admin people matching the audience. */
async function findRecipients(audience, city, userIds) {
    if (audience === 'SELECTED') {
        return prisma.user.findMany({
            where: { id: { in: userIds }, isBanned: false, role: 'USER' },
            select: { id: true },
        });
    }
    return prisma.user.findMany({ where: audienceWhere(audience, city), select: { id: true } });
}

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const day = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

// GET /api/admin/offers — every offer with what it has cost so far
adminOffersRouter.get('/offers', async (_req, res) => {
    const offers = await prisma.offer.findMany({
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    const ids = offers.map((o) => o.id);
    const [redemptions, grants] = await Promise.all([
        prisma.offerRedemption.groupBy({ by: ['offerId'], where: { offerId: { in: ids } }, _count: { _all: true }, _sum: { amount: true } }),
        prisma.promoGrant.groupBy({ by: ['offerId'], where: { offerId: { in: ids } }, _count: { _all: true }, _sum: { amount: true, remaining: true } }),
    ]);
    const used = Object.fromEntries(redemptions.map((r) => [r.offerId, r]));
    const granted = Object.fromEntries(grants.map((g) => [g.offerId, g]));

    res.json({
        success: true,
        data: offers.map((o) => ({
            ...o,
            summary: o.kind === 'DISCOUNT' ? describeDiscount(o) : `${fmt(o.creditAmount)} wallet credit each`,
            stats: o.kind === 'DISCOUNT'
                ? { uses: used[o.id]?._count._all || 0, discountGiven: round2(used[o.id]?._sum.amount || 0) }
                : {
                    credited: granted[o.id]?._count._all || 0,
                    creditGiven: round2(granted[o.id]?._sum.amount || 0),
                    creditUnspent: round2(granted[o.id]?._sum.remaining || 0),
                },
        })),
    });
});

// POST /api/admin/offers/preview { audience, city, userIds } — how many people would get it
adminOffersRouter.post('/offers/preview', async (req, res) => {
    const audience = String(req.body?.audience || 'ALL').toUpperCase();
    if (!OFFER_AUDIENCES.includes(audience)) throw new AppError('Choose who gets the offer.', 400);
    const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.map(String).slice(0, MAX_SELECTED_PEOPLE) : [];
    if (audience === 'CITY' && String(req.body?.city || '').trim().length < 2) {
        return res.json({ success: true, data: { recipients: 0 } });
    }
    const people = await findRecipients(audience, req.body?.city, userIds);
    res.json({ success: true, data: { recipients: people.length } });
});

// POST /api/admin/offers — create and send
adminOffersRouter.post('/offers', async (req, res) => {
    const { data, userIds } = readOfferInput(req.body);
    const people = await findRecipients(data.audience, data.city, userIds);
    if (!people.length) throw new AppError('Nobody matches this audience.', 400);

    if (data.kind === 'CREDIT') {
        const total = round2(data.creditAmount * people.length);
        if (total > maxOfferCreditTotal()) {
            throw new AppError(
                `This would hand out ${fmt(total)} in credit, above the ${fmt(maxOfferCreditTotal())} limit per offer. Lower the amount or the audience.`,
                400,
            );
        }
    }

    const offer = await prisma.offer.create({
        data: { ...data, recipients: people.length, createdById: req.user.id },
    });
    await prisma.offerRecipient.createMany({
        data: people.map((p) => ({ offerId: offer.id, userId: p.id })),
        skipDuplicates: true,
    });

    // Wallet credits are granted now; each grant is idempotent, so a retry cannot double-pay.
    let credited = 0;
    let failed = 0;
    if (data.kind === 'CREDIT') {
        for (let i = 0; i < people.length; i += PARALLEL_GRANTS) {
            const batch = people.slice(i, i + PARALLEL_GRANTS);
            const results = await Promise.allSettled(batch.map((p) => creditPromo({
                userId: p.id,
                amount: data.creditAmount,
                referenceId: `offer_${offer.id}_${p.id}`,
                description: `Offer: ${data.title}`,
                expiresAt: data.creditExpiresAt,
                source: 'OFFER',
                note: data.title,
                offerId: offer.id,
                grantedById: req.user.id,
            })));
            results.forEach((r) => { if (r.status === 'fulfilled') credited += 1; else failed += 1; });
        }
        if (failed) console.error(`[offers] ${failed} credit grant(s) failed for offer ${offer.id}`);
    }

    const extra = data.kind === 'CREDIT'
        ? `${fmt(data.creditAmount)} has been added to your wallet as promo credit for car and bike rentals${data.creditExpiresAt ? `, valid until ${day(data.creditExpiresAt)}` : ''}.`
        : `${describeDiscount(data)}, applied automatically when you pay${data.validUntil ? ` until ${day(data.validUntil)}` : ''}.`;
    for (let i = 0; i < people.length; i += 1000) {
        await prisma.notification.createMany({
            data: people.slice(i, i + 1000).map((p) => ({
                userId: p.id,
                type: 'SYSTEM',
                title: data.title,
                body: `${data.message}\n\n${extra}`.slice(0, 1000),
                data: { offerId: offer.id },
            })),
        });
    }

    const who = data.audience === 'SELECTED'
        ? `${people.length} selected ${people.length === 1 ? 'person' : 'people'}`
        : `${people.length} ${people.length === 1 ? 'person' : 'people'} (${data.audience === 'CITY' ? `in ${data.city}` : data.audience.toLowerCase()})`;
    await logAdminAction(req, {
        action: 'OFFER_SEND',
        targetType: 'OFFER',
        targetId: offer.id,
        summary: data.kind === 'CREDIT'
            ? `Offer “${data.title}”: ${fmt(data.creditAmount)} credit to ${who}`
            : `Offer “${data.title}”: ${describeDiscount(data)} for ${who}`,
        metadata: { kind: data.kind, recipients: people.length, credited, failed },
    });

    res.status(201).json({ success: true, data: { ...offer, credited, failed } });
});

// POST /api/admin/offers/:id/end — stop a discount from applying (credit already given stays)
adminOffersRouter.post('/offers/:id/end', async (req, res) => {
    const ended = await prisma.offer.updateMany({
        where: { id: req.params.id, status: 'ACTIVE' },
        data: { status: 'ENDED', endedAt: new Date() },
    });
    if (ended.count === 0) throw new AppError('Offer not found or already ended.', 404);
    const offer = await prisma.offer.findUnique({ where: { id: req.params.id } });
    await logAdminAction(req, {
        action: 'OFFER_END',
        targetType: 'OFFER',
        targetId: offer.id,
        summary: `Ended offer “${offer.title}”`,
    });
    res.json({ success: true, data: offer });
});
