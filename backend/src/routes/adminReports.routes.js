import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { notifyUser } from '../utils/notify.js';
import { logAdminAction } from '../utils/audit.js';
import { REPORT_CATEGORIES } from './report.routes.js';

/** Admin queue for customer reports & disputes. */
export const adminReportsRouter = Router();

const STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'];

// GET /api/admin/reports?status=&priority=&category=
adminReportsRouter.get('/reports', async (req, res) => {
    const status = String(req.query.status || 'ACTIVE').toUpperCase();
    const where = {};
    if (status === 'ACTIVE') where.status = { in: ['OPEN', 'IN_REVIEW'] };
    else if (STATUSES.includes(status)) where.status = status;
    if (req.query.priority) where.priority = String(req.query.priority).toUpperCase();
    if (req.query.category && REPORT_CATEGORIES[String(req.query.category).toUpperCase()]) {
        where.category = String(req.query.category).toUpperCase();
    }

    const [rows, counts] = await Promise.all([
        prisma.report.findMany({
            where,
            include: {
                reporter: { select: { id: true, name: true, email: true } },
                assignedAdmin: { select: { id: true, name: true } },
                _count: { select: { messages: true } },
            },
            // High priority first, then oldest waiting
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
            take: 200,
        }),
        prisma.report.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    res.json({
        success: true,
        data: rows,
        counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
        categories: Object.fromEntries(Object.entries(REPORT_CATEGORIES).map(([k, v]) => [k, v.label])),
    });
});

async function describeTarget(report) {
    if (!report.targetId) return null;
    switch (report.targetType) {
        case 'USER': {
            const u = await prisma.user.findUnique({ where: { id: report.targetId }, select: { id: true, name: true, email: true, isBanned: true } });
            return u && { type: 'USER', id: u.id, label: u.name, sub: u.email, isBanned: u.isBanned };
        }
        case 'LISTING': {
            const l = await prisma.rentalListing.findUnique({
                where: { id: report.targetId },
                select: { id: true, isActive: true, location: true, hostId: true, vehicle: { select: { make: true, model: true, licensePlate: true } } },
            });
            return l && { type: 'LISTING', id: l.id, label: `${l.vehicle.make} ${l.vehicle.model} (${l.vehicle.licensePlate})`, sub: l.location, isActive: l.isActive, hostId: l.hostId };
        }
        case 'TRIP': {
            const t = await prisma.trip.findUnique({ where: { id: report.targetId }, select: { id: true, title: true, destination: true, organizerId: true } });
            return t && { type: 'TRIP', id: t.id, label: t.title, sub: t.destination, organizerId: t.organizerId };
        }
        default:
            return null;
    }
}

// GET /api/admin/reports/:id
adminReportsRouter.get('/reports/:id', async (req, res) => {
    const report = await prisma.report.findUnique({
        where: { id: req.params.id },
        include: {
            reporter: { select: { id: true, name: true, email: true, phoneNumber: true } },
            assignedAdmin: { select: { id: true, name: true } },
            messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true } } } },
            booking: {
                select: {
                    id: true, startDate: true, endDate: true, status: true, totalPrice: true, hostAmount: true, platformFee: true,
                    renter: { select: { id: true, name: true } },
                    listing: { select: { id: true, hostId: true, host: { select: { id: true, name: true } }, vehicle: { select: { make: true, model: true, licensePlate: true } } } },
                    hostEarning: { select: { id: true, status: true, amount: true, releaseAt: true, note: true } },
                },
            },
        },
    });
    if (!report) throw new AppError('Report not found.', 404);
    const payment = report.booking
        ? await prisma.walletTransaction.findFirst({
            where: { referenceId: `rental_${report.booking.id}`, type: 'SPEND', status: 'SUCCESS' },
            select: { id: true },
        })
        : null;
    const paymentRow = payment
        ? await prisma.payment.findFirst({ where: { stripePaymentId: `wallet_${payment.id}` }, select: { id: true, status: true, amount: true } })
        : null;

    res.json({ success: true, data: { ...report, target: await describeTarget(report), payment: paymentRow } });
});

// POST /api/admin/reports/:id/messages { body } — reply to the customer
adminReportsRouter.post('/reports/:id/messages', async (req, res) => {
    const body = String(req.body?.body || '').trim();
    if (body.length < 2 || body.length > 4000) throw new AppError('Write a reply (up to 4000 characters).', 400);
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) throw new AppError('Report not found.', 404);

    await prisma.$transaction([
        prisma.reportMessage.create({ data: { reportId: report.id, authorId: req.user.id, fromAdmin: true, body } }),
        prisma.report.update({
            where: { id: report.id },
            data: {
                ...(report.status === 'OPEN' ? { status: 'IN_REVIEW' } : {}),
                ...(report.assignedAdminId ? {} : { assignedAdminId: req.user.id }),
            },
        }),
    ]);
    await notifyUser({
        userId: report.reporterId,
        type: 'SYSTEM',
        title: 'Reply on your report',
        body: `PickAndSync support replied on “${report.subject}”.`,
        data: { reportId: report.id },
    });
    await logAdminAction(req, {
        action: 'REPORT_REPLY', targetType: 'REPORT', targetId: report.id,
        summary: `Replied on report “${report.subject}”`,
    });
    res.status(201).json({ success: true });
});

// PATCH /api/admin/reports/:id { status?, resolution?, assignToMe? }
adminReportsRouter.patch('/reports/:id', async (req, res) => {
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) throw new AppError('Report not found.', 404);

    const data = {};
    const status = req.body?.status ? String(req.body.status).toUpperCase() : null;
    const resolution = req.body?.resolution ? String(req.body.resolution).trim().slice(0, 2000) : null;
    if (status) {
        if (!STATUSES.includes(status)) throw new AppError('Invalid status.', 400);
        if (['RESOLVED', 'DISMISSED'].includes(status) && !resolution) {
            throw new AppError('Write what was decided — the customer sees it.', 400);
        }
        data.status = status;
        data.resolvedAt = ['RESOLVED', 'DISMISSED'].includes(status) ? new Date() : null;
    }
    if (resolution) data.resolution = resolution;
    if (req.body?.assignToMe) data.assignedAdminId = req.user.id;
    if (!Object.keys(data).length) throw new AppError('Nothing to update.', 400);

    const updated = await prisma.report.update({ where: { id: report.id }, data });

    if (status && status !== report.status) {
        const closed = ['RESOLVED', 'DISMISSED'].includes(status);
        await notifyUser({
            userId: report.reporterId,
            type: 'SYSTEM',
            title: closed ? 'Your report was closed' : 'Your report is being reviewed',
            body: closed ? `“${report.subject}”: ${resolution}` : `We're looking into “${report.subject}”.`,
            data: { reportId: report.id },
        });
        if (closed && resolution) {
            await prisma.reportMessage.create({ data: { reportId: report.id, authorId: req.user.id, fromAdmin: true, body: `Closed (${status.toLowerCase()}): ${resolution}` } });
        }
    }
    await logAdminAction(req, {
        action: 'REPORT_UPDATE', targetType: 'REPORT', targetId: report.id,
        summary: `Report “${report.subject}”${status ? ` → ${status}` : ''}${data.assignedAdminId ? ' (assigned)' : ''}`,
        metadata: { from: report.status, to: status, resolution },
    });
    res.json({ success: true, data: updated });
});
