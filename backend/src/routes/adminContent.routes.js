import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { notifyUser } from '../utils/notify.js';
import { logAdminAction } from '../utils/audit.js';
import { AUDIENCES, audienceWhere } from '../utils/audiences.js';

/** Content moderation, broadcasts, global search and admin 2FA resets. */
export const adminContentRouter = Router();

/* ------------------------------------------------------------------ */
/* Moderation                                                          */
/* ------------------------------------------------------------------ */

// GET /api/admin/trips/:id/chat — latest messages + announcements for moderation
adminContentRouter.get('/trips/:id/chat', async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id }, select: { id: true, title: true } });
    if (!trip) throw new AppError('Trip not found.', 404);
    const [messages, announcements] = await Promise.all([
        prisma.message.findMany({
            where: { tripId: trip.id },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100,
        }),
        prisma.announcement.findMany({
            where: { tripId: trip.id },
            include: { author: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
        }),
    ]);
    res.json({ success: true, data: { trip, messages: messages.reverse(), announcements } });
});

// DELETE /api/admin/messages/:id — remove an abusive chat message
adminContentRouter.delete('/messages/:id', async (req, res) => {
    const message = await prisma.message.findUnique({
        where: { id: req.params.id },
        include: { user: { select: { name: true } }, trip: { select: { id: true, title: true } } },
    });
    if (!message) throw new AppError('Message not found.', 404);
    await prisma.message.delete({ where: { id: message.id } });

    // Remove it from everyone's open chat immediately
    req.app.get('io')?.to(`trip:${message.tripId}`).emit('message_deleted', { id: message.id, tripId: message.tripId });
    await logAdminAction(req, {
        action: 'MESSAGE_DELETE', targetType: 'TRIP', targetId: message.tripId,
        summary: `Deleted ${message.user?.name || 'a user'}'s chat message in “${message.trip.title}”`,
        metadata: { messageId: message.id, userId: message.userId, content: message.content.slice(0, 500) },
    });
    res.json({ success: true });
});

// DELETE /api/admin/announcements/:id
adminContentRouter.delete('/announcements/:id', async (req, res) => {
    const a = await prisma.announcement.findUnique({ where: { id: req.params.id }, include: { trip: { select: { title: true } } } });
    if (!a) throw new AppError('Announcement not found.', 404);
    await prisma.announcement.delete({ where: { id: a.id } });
    await logAdminAction(req, {
        action: 'ANNOUNCEMENT_DELETE', targetType: 'TRIP', targetId: a.tripId,
        summary: `Deleted announcement “${a.title}” in “${a.trip.title}”`,
        metadata: { title: a.title, content: a.content.slice(0, 500), authorId: a.authorId },
    });
    res.json({ success: true });
});

// PATCH /api/admin/rentals/listings/:id/details { pricePerDay?, location?, description? }
adminContentRouter.patch('/rentals/listings/:id/details', async (req, res) => {
    const listing = await prisma.rentalListing.findUnique({ where: { id: req.params.id }, include: { vehicle: true } });
    if (!listing) throw new AppError('Listing not found.', 404);

    const data = {};
    const changes = [];
    if (req.body?.pricePerDay !== undefined) {
        const price = Number(req.body.pricePerDay);
        if (!Number.isFinite(price) || price <= 0 || price > 1000000) throw new AppError('Enter a valid price per day.', 400);
        data.pricePerDay = price;
        changes.push(`price ₹${listing.pricePerDay} → ₹${price}`);
    }
    if (req.body?.location !== undefined) {
        const location = String(req.body.location).trim();
        if (location.length < 2) throw new AppError('Location is required.', 400);
        data.location = location.slice(0, 200);
        changes.push('location');
    }
    if (req.body?.description !== undefined) {
        data.description = String(req.body.description).trim().slice(0, 2000) || null;
        changes.push('description');
    }
    if (!changes.length) throw new AppError('Nothing to update.', 400);

    const updated = await prisma.rentalListing.update({ where: { id: listing.id }, data });
    const label = `${listing.vehicle.make} ${listing.vehicle.model}`;
    await notifyUser({
        userId: listing.hostId,
        type: 'SYSTEM',
        title: 'Listing edited by PickAndSync',
        body: `We updated your ${label} listing (${changes.join(', ')}) to meet our listing guidelines.`,
        data: { listingId: listing.id },
    });
    await logAdminAction(req, {
        action: 'LISTING_EDIT', targetType: 'LISTING', targetId: listing.id,
        summary: `Edited listing ${label}: ${changes.join(', ')}`,
        metadata: { before: { pricePerDay: listing.pricePerDay, location: listing.location, description: listing.description }, after: data },
    });
    res.json({ success: true, data: updated });
});

// PATCH /api/admin/vehicles/:id/images { images } — remove inappropriate photos (removal only)
adminContentRouter.patch('/vehicles/:id/images', async (req, res) => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) throw new AppError('Vehicle not found.', 404);
    const images = Array.isArray(req.body?.images) ? req.body.images : null;
    if (!images || images.some((url) => !vehicle.images.includes(url))) {
        throw new AppError('Photos can only be removed here, not added.', 400);
    }
    const removed = vehicle.images.filter((url) => !images.includes(url));
    if (!removed.length) throw new AppError('No photos were removed.', 400);

    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { images } });
    await notifyUser({
        userId: vehicle.ownerId,
        type: 'SYSTEM',
        title: 'Vehicle photo removed',
        body: `We removed ${removed.length} photo(s) from your ${vehicle.make} ${vehicle.model} that broke our listing guidelines.`,
        data: { vehicleId: vehicle.id },
    });
    await logAdminAction(req, {
        action: 'VEHICLE_PHOTO_REMOVE', targetType: 'VEHICLE', targetId: vehicle.id,
        summary: `Removed ${removed.length} photo(s) from ${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})`,
        metadata: { removed },
    });
    res.json({ success: true, data: { images } });
});

/* ------------------------------------------------------------------ */
/* Broadcasts                                                          */
/* ------------------------------------------------------------------ */

function readBroadcast(body) {
    const audience = String(body?.audience || 'ALL').toUpperCase();
    if (!AUDIENCES.includes(audience)) throw new AppError('Choose an audience.', 400);
    return { audience, city: audience === 'CITY' ? String(body?.city || '').trim().slice(0, 80) : null };
}

// POST /api/admin/broadcasts/preview { audience, city } — how many people will get it
adminContentRouter.post('/broadcasts/preview', async (req, res) => {
    const { audience, city } = readBroadcast(req.body);
    const recipients = await prisma.user.count({ where: audienceWhere(audience, city) });
    res.json({ success: true, data: { recipients } });
});

// POST /api/admin/broadcasts { title, body, audience, city }
adminContentRouter.post('/broadcasts', async (req, res) => {
    const { audience, city } = readBroadcast(req.body);
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    if (title.length < 3 || title.length > 80) throw new AppError('Title must be 3–80 characters.', 400);
    if (body.length < 5 || body.length > 500) throw new AppError('Message must be 5–500 characters.', 400);

    const users = await prisma.user.findMany({ where: audienceWhere(audience, city), select: { id: true } });
    if (!users.length) throw new AppError('Nobody matches this audience.', 400);

    const broadcast = await prisma.broadcast.create({
        data: { adminId: req.user.id, title, body, audience, city, recipients: users.length },
    });
    for (let i = 0; i < users.length; i += 1000) {
        await prisma.notification.createMany({
            data: users.slice(i, i + 1000).map((u) => ({
                userId: u.id, type: 'SYSTEM', title, body, data: { broadcastId: broadcast.id },
            })),
        });
    }
    await logAdminAction(req, {
        action: 'BROADCAST_SEND', targetType: 'BROADCAST', targetId: broadcast.id,
        summary: `Broadcast “${title}” to ${users.length} ${users.length === 1 ? 'person' : 'people'} (${audience === 'CITY' ? `in ${city}` : audience.toLowerCase()})`,
        metadata: { audience, city, recipients: users.length },
    });
    res.status(201).json({ success: true, data: broadcast });
});

// GET /api/admin/broadcasts — history
adminContentRouter.get('/broadcasts', async (_req, res) => {
    const rows = await prisma.broadcast.findMany({
        include: { admin: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.json({ success: true, data: rows });
});

/* ------------------------------------------------------------------ */
/* Global search                                                       */
/* ------------------------------------------------------------------ */

const UUID_PREFIX = /^[0-9a-f-]{6,36}$/i;

// GET /api/admin/search?q=
adminContentRouter.get('/search', async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q.length < 2) return res.json({ success: true, data: {} });
    const contains = { contains: q, mode: 'insensitive' };
    const idMatch = UUID_PREFIX.test(q) ? { startsWith: q.toLowerCase() } : undefined;
    const plate = q.replace(/[^a-z0-9]/gi, '').toUpperCase();

    const [users, trips, bookings, payments, transactions, vehicles, reports] = await Promise.all([
        prisma.user.findMany({
            where: {
                OR: [
                    { name: contains }, { email: contains }, { phoneNumber: contains },
                    { referralCode: q.toUpperCase() },
                    ...(idMatch ? [{ id: idMatch }] : []),
                ],
            },
            select: { id: true, name: true, email: true, role: true, isBanned: true },
            take: 6,
        }),
        prisma.trip.findMany({
            where: { OR: [{ title: contains }, { destination: contains }, ...(idMatch ? [{ id: idMatch }] : [])] },
            select: { id: true, title: true, destination: true, status: true },
            take: 6,
        }),
        prisma.rentalBooking.findMany({
            where: {
                OR: [
                    ...(idMatch ? [{ id: idMatch }] : []),
                    ...(plate.length >= 4 ? [{ listing: { vehicle: { licensePlate: { contains: plate } } } }] : []),
                ],
            },
            select: {
                id: true, status: true, totalPrice: true, startDate: true,
                renter: { select: { id: true, name: true } },
                listing: { select: { vehicle: { select: { make: true, model: true, licensePlate: true } } } },
            },
            take: 6,
        }),
        prisma.payment.findMany({
            where: { OR: [{ stripePaymentId: contains }, ...(idMatch ? [{ id: idMatch }] : [])] },
            select: { id: true, amount: true, status: true, stripePaymentId: true, user: { select: { id: true, name: true } } },
            take: 6,
        }),
        prisma.walletTransaction.findMany({
            where: {
                OR: [
                    { referenceId: contains },
                    { metadata: { path: ['manualSettlement', 'reference'], equals: q } },
                    { metadata: { path: ['upiId'], equals: q } },
                    ...(idMatch ? [{ id: idMatch }] : []),
                ],
            },
            select: { id: true, type: true, status: true, amount: true, referenceId: true, wallet: { select: { user: { select: { id: true, name: true } } } } },
            take: 6,
        }),
        plate.length >= 4
            ? prisma.vehicle.findMany({
                where: { licensePlate: { contains: plate } },
                select: { id: true, make: true, model: true, licensePlate: true, isVerified: true, owner: { select: { id: true, name: true } } },
                take: 6,
            })
            : [],
        prisma.report.findMany({
            where: { OR: [{ subject: contains }, ...(idMatch ? [{ id: idMatch }] : [])] },
            select: { id: true, subject: true, status: true, priority: true },
            take: 6,
        }),
    ]);

    res.json({ success: true, data: { users, trips, bookings, payments, transactions, vehicles, reports } });
});

/* ------------------------------------------------------------------ */
/* Admin 2FA reset (lost phone)                                         */
/* ------------------------------------------------------------------ */

// POST /api/admin/users/:id/2fa/reset — another admin's authenticator is lost
adminContentRouter.post('/users/:id/2fa/reset', async (req, res) => {
    if (req.params.id === req.user.id) throw new AppError('Use your own security settings to change your two-factor.', 400);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target || target.role !== 'ADMIN') throw new AppError('Only admin accounts have two-factor.', 400);
    if (!target.totpEnabled) throw new AppError('This admin has not set up two-factor.', 400);

    await prisma.user.update({
        where: { id: target.id },
        // Clearing the refresh token also signs them out everywhere
        data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [], totpLastStep: null, refreshToken: null },
    });
    await logAdminAction(req, {
        action: 'MFA_RESET', targetType: 'USER', targetId: target.id,
        summary: `Reset two-factor for admin ${target.name}`,
    });
    res.json({ success: true, message: `${target.name} must set up Google Authenticator again on next sign-in.` });
});
