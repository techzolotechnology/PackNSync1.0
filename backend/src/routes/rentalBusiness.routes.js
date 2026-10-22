import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { normalizeBusiness } from '../utils/rentalBusiness.js';
import { logAdminAction } from '../utils/audit.js';
export const businessRouter = Router();
export const adminBusinessRouter = Router();
businessRouter.get('/', async (req, res) => {
    const data = await prisma.rentalBusinessProfile.findUnique({ where: { userId: req.user.id } });
    res.json({ success: true, data });
});
businessRouter.put('/', async (req, res) => {
    const data = normalizeBusiness(req.body);
    const profile = await prisma.$transaction(async (tx) => {
        // Same user lock serializes edits and reviews, including first profile creation.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user.id} FOR UPDATE`;
        const current = await tx.rentalBusinessProfile.findUnique({ where: { userId: req.user.id } });
        if (current && Object.entries(data).every(([key, value]) => current[key] === value)) return current;
        if (current && req.body.expectedVersion !== current.version) throw new AppError('Business details changed. Reload before saving.', 409);
        const next = { ...data, status: data.hostType === 'RENTAL_SHOP' ? 'PENDING' : 'NONE', reviewNotes: '', reviewedBy: null, reviewedAt: null };
        return tx.rentalBusinessProfile.upsert({ where: { userId: req.user.id }, create: { userId: req.user.id, ...next }, update: { ...next, version: { increment: 1 } } });
    });
    res.json({ success: true, data: profile });
});
adminBusinessRouter.get('/businesses', async (_req, res) => {
    const data = await prisma.rentalBusinessProfile.findMany({ where: { hostType: 'RENTAL_SHOP' }, include: { user: { select: { id: true, name: true } } }, orderBy: { updatedAt: 'desc' }, take: 200 });
    res.json({ success: true, data });
});
adminBusinessRouter.patch('/businesses/:id/review', async (req, res) => {
    const { status, expectedVersion, reviewNotes } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status) || !Number.isInteger(expectedVersion) || typeof reviewNotes !== 'string' || !reviewNotes.trim() || reviewNotes.length > 1000) throw new AppError('Choose a decision and record the verification checks or rejection reason.', 400);
    if (req.params.id === req.user.id) throw new AppError('Another admin must review your business.', 403);
    const data = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.params.id} FOR UPDATE`;
        const result = await tx.rentalBusinessProfile.updateMany({ where: { userId: req.params.id, hostType: 'RENTAL_SHOP', version: expectedVersion }, data: { status, reviewNotes: reviewNotes.trim(), reviewedBy: req.user.id, reviewedAt: new Date(), version: { increment: 1 } } });
        if (!result.count) throw new AppError('Business details changed. Reload before reviewing.', 409);
        return tx.rentalBusinessProfile.findUnique({ where: { userId: req.params.id } });
    });
    await logAdminAction(req, { action: 'BUSINESS_REVIEW', targetType: 'User', targetId: req.params.id, summary: `Rental business ${status.toLowerCase()}`, metadata: { version: data.version, reviewNotes: data.reviewNotes } });
    res.json({ success: true, data });
});
