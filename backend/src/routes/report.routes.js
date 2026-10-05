import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { REPORT_UPLOAD_DIR, reportEvidenceUpload } from '../middleware/reportUpload.middleware.js';
import { adminMfaRequired, adminMfaSessionMs } from '../middleware/adminMfa.middleware.js';
import { holdEarningForBooking } from '../utils/hostEarnings.js';
import { sendAdminAlert } from '../utils/adminAlerts.js';

/** Customer reports & disputes. */
export const reportRouter = Router();

export const REPORT_CATEGORIES = {
    SAFETY: { label: 'Safety concern', priority: 'HIGH' },
    HARASSMENT: { label: 'Harassment or abuse', priority: 'HIGH' },
    FRAUD: { label: 'Scam or fraud', priority: 'HIGH' },
    VEHICLE_DAMAGE: { label: 'Vehicle damage', priority: 'NORMAL' },
    PAYMENT: { label: 'Payment or refund problem', priority: 'NORMAL' },
    LISTING_INACCURATE: { label: 'Listing not as described', priority: 'NORMAL' },
    OTHER: { label: 'Something else', priority: 'NORMAL' },
};
const TARGET_TYPES = ['USER', 'LISTING', 'TRIP', 'BOOKING', 'OTHER'];
const OPEN_STATUSES = ['OPEN', 'IN_REVIEW'];
const MAX_REPORTS_PER_DAY = 10;

reportRouter.use(authenticate);

const isAdminWithMfa = (req) => {
    if (req.user.role !== 'ADMIN') return false;
    if (!adminMfaRequired()) return true;
    const mfaAt = Number(req.auth?.mfaAt) || 0;
    return Boolean(req.user.totpEnabled && mfaAt && Date.now() - mfaAt <= adminMfaSessionMs());
};

// POST /api/reports/evidence — upload one photo; returns its private URL
reportRouter.post('/evidence', reportEvidenceUpload.single('image'), (req, res) => {
    if (!req.file) throw new AppError('Choose a photo to upload.', 400);
    res.status(201).json({ success: true, data: { url: `/api/reports/evidence/${req.file.filename}` } });
});

// GET /api/reports/evidence/:file — only the uploader and admins
reportRouter.get('/evidence/:file', (req, res) => {
    const file = path.basename(String(req.params.file || ''));
    const owner = file.split('_')[0];
    if (owner !== req.user.id && !isAdminWithMfa(req)) throw new AppError('File not found.', 404);
    const filePath = path.join(REPORT_UPLOAD_DIR, file);
    if (!fs.existsSync(filePath)) throw new AppError('File not found.', 404);
    res.set('Cache-Control', 'private, no-store');
    res.sendFile(filePath);
});

// GET /api/reports/options — the user's own bookings and trips to attach a report to
reportRouter.get('/options', async (req, res) => {
    const [asRenter, asHost, trips] = await Promise.all([
        prisma.rentalBooking.findMany({
            where: { renterId: req.user.id },
            select: { id: true, startDate: true, status: true, listing: { select: { id: true, vehicle: { select: { make: true, model: true } }, host: { select: { id: true, name: true } } } } },
            orderBy: { createdAt: 'desc' },
            take: 15,
        }),
        prisma.rentalBooking.findMany({
            where: { listing: { hostId: req.user.id } },
            select: { id: true, startDate: true, status: true, renter: { select: { id: true, name: true } }, listing: { select: { id: true, vehicle: { select: { make: true, model: true } } } } },
            orderBy: { createdAt: 'desc' },
            take: 15,
        }),
        prisma.trip.findMany({
            where: { OR: [{ organizerId: req.user.id }, { members: { some: { userId: req.user.id, status: 'APPROVED' } } }] },
            select: { id: true, title: true, destination: true, startDate: true },
            orderBy: { startDate: 'desc' },
            take: 15,
        }),
    ]);
    res.json({
        success: true,
        data: {
            categories: Object.entries(REPORT_CATEGORIES).map(([id, c]) => ({ id, label: c.label })),
            bookings: [
                ...asRenter.map((b) => ({ id: b.id, role: 'renter', label: `${b.listing.vehicle.make} ${b.listing.vehicle.model} · host ${b.listing.host.name}`, startDate: b.startDate, status: b.status })),
                ...asHost.map((b) => ({ id: b.id, role: 'host', label: `${b.listing.vehicle.make} ${b.listing.vehicle.model} · renter ${b.renter.name}`, startDate: b.startDate, status: b.status })),
            ],
            trips,
        },
    });
});

// POST /api/reports
reportRouter.post('/', async (req, res) => {
    const category = String(req.body?.category || '').toUpperCase();
    const targetType = String(req.body?.targetType || 'OTHER').toUpperCase();
    const targetId = req.body?.targetId ? String(req.body.targetId).slice(0, 64) : null;
    const bookingId = req.body?.bookingId ? String(req.body.bookingId) : null;
    const subject = String(req.body?.subject || '').trim();
    const description = String(req.body?.description || '').trim();
    const evidence = Array.isArray(req.body?.evidence) ? req.body.evidence.slice(0, 4) : [];

    if (!REPORT_CATEGORIES[category]) throw new AppError('Choose what kind of problem this is.', 400);
    if (!TARGET_TYPES.includes(targetType)) throw new AppError('Invalid report target.', 400);
    if (subject.length < 5 || subject.length > 120) throw new AppError('Give the report a short title (5–120 characters).', 400);
    if (description.length < 20 || description.length > 4000) {
        throw new AppError('Describe what happened in at least 20 characters.', 400);
    }
    // Evidence must be photos this user uploaded
    const ownPrefix = `/api/reports/evidence/${req.user.id}_`;
    if (evidence.some((url) => typeof url !== 'string' || !url.startsWith(ownPrefix))) {
        throw new AppError('Attach photos using the upload button.', 400);
    }

    const recent = await prisma.report.count({
        where: { reporterId: req.user.id, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    });
    if (recent >= MAX_REPORTS_PER_DAY) throw new AppError('You have filed many reports today. Please add details to an existing one.', 429);

    let booking = null;
    if (bookingId) {
        booking = await prisma.rentalBooking.findUnique({ where: { id: bookingId }, include: { listing: { select: { hostId: true } } } });
        if (!booking || (booking.renterId !== req.user.id && booking.listing.hostId !== req.user.id)) {
            throw new AppError('You can only report bookings you are part of.', 403);
        }
    }
    if (targetId && targetType === 'USER' && !(await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }))) {
        throw new AppError('That user no longer exists.', 404);
    }
    if (targetId && targetType === 'LISTING' && !(await prisma.rentalListing.findUnique({ where: { id: targetId }, select: { id: true } }))) {
        throw new AppError('That listing no longer exists.', 404);
    }
    if (targetId && targetType === 'TRIP' && !(await prisma.trip.findUnique({ where: { id: targetId }, select: { id: true } }))) {
        throw new AppError('That trip no longer exists.', 404);
    }

    const { priority } = REPORT_CATEGORIES[category];
    const report = await prisma.report.create({
        data: {
            reporterId: req.user.id,
            category,
            priority,
            targetType: booking && targetType === 'OTHER' ? 'BOOKING' : targetType,
            targetId: targetId || (booking ? booking.id : null),
            bookingId: booking?.id || null,
            subject,
            description,
            evidence,
            messages: { create: { authorId: req.user.id, fromAdmin: false, body: description } },
        },
    });

    // A renter disputing a paid booking freezes the host's payout until an admin decides.
    let earningHeld = false;
    if (booking && booking.renterId === req.user.id) {
        earningHeld = await holdEarningForBooking(booking.id, `Renter dispute: ${subject}`);
    }

    if (priority === 'HIGH') {
        sendAdminAlert({
            subject: `High-priority report: ${REPORT_CATEGORIES[category].label}`,
            intro: `${req.user.name} filed a ${REPORT_CATEGORIES[category].label.toLowerCase()} report that needs quick review.`,
            details: [['Title', subject], ['Reporter', `${req.user.name} <${req.user.email || req.user.id}>`], ['Report id', report.id]],
        });
    }

    res.status(201).json({ success: true, data: report, earningHeld });
});

// GET /api/reports/mine
reportRouter.get('/mine', async (req, res) => {
    const reports = await prisma.report.findMany({
        where: { reporterId: req.user.id },
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { updatedAt: 'desc' },
        take: 50,
    });
    res.json({ success: true, data: reports });
});

async function loadOwnReport(req) {
    const report = await prisma.report.findUnique({
        where: { id: req.params.id },
        include: {
            messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true } } } },
            booking: { select: { id: true, startDate: true, endDate: true, status: true, listing: { select: { vehicle: { select: { make: true, model: true } } } } } },
        },
    });
    if (!report || (report.reporterId !== req.user.id && !isAdminWithMfa(req))) throw new AppError('Report not found.', 404);
    return report;
}

// GET /api/reports/:id
reportRouter.get('/:id', async (req, res) => {
    const report = await loadOwnReport(req);
    // Admin names stay private to customers
    const messages = report.messages.map((m) => ({
        id: m.id, fromAdmin: m.fromAdmin, body: m.body, createdAt: m.createdAt,
        author: m.fromAdmin ? { name: 'PickAndSync support' } : m.author,
    }));
    res.json({ success: true, data: { ...report, messages } });
});

// POST /api/reports/:id/messages { body }
reportRouter.post('/:id/messages', async (req, res) => {
    const report = await loadOwnReport(req);
    if (report.reporterId !== req.user.id) throw new AppError('Reply from the admin panel.', 403);
    if (!OPEN_STATUSES.includes(report.status)) throw new AppError('This report is closed. File a new one if the problem continues.', 400);
    const body = String(req.body?.body || '').trim();
    if (body.length < 2 || body.length > 4000) throw new AppError('Write a message (up to 4000 characters).', 400);

    const message = await prisma.reportMessage.create({ data: { reportId: report.id, authorId: req.user.id, body } });
    await prisma.report.update({ where: { id: report.id }, data: { updatedAt: new Date() } });
    res.status(201).json({ success: true, data: message });
});
