import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { notifyUser } from '../utils/notify.js';
import {
    listVerifications,
    approveVerification,
    rejectVerification,
    listVehiclesForReview,
    verifyVehicle,
    rejectVehicle,
} from '../controllers/adminVerification.controller.js';

export const adminRouter = Router();

const ROLES = ['USER', 'ADMIN'];
const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'PAID'];
const TRIP_STATUSES = ['DRAFT', 'OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const MEMBER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'LEFT'];

adminRouter.use(authenticate, authorize('ADMIN'));

// GET /api/admin/stats
adminRouter.get('/stats', async (_req, res) => {
    const [
        userCount,
        bannedCount,
        tripCount,
        paymentTotal,
        pendingVerifications,
        rideCount,
        rentalCount,
        activeListings,
        pendingBookings,
        openTrips,
        tripOrganizers,
        vehicleHosts,
        pendingJoins,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isBanned: true } }),
        prisma.trip.count(),
        prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'succeeded' } }),
        prisma.verification.count({ where: { status: 'PENDING' } }),
        prisma.rideBooking.count(),
        prisma.rentalBooking.count(),
        prisma.rentalListing.count({ where: { isActive: true } }),
        prisma.rentalBooking.count({ where: { status: 'PENDING' } }),
        prisma.trip.count({ where: { status: 'OPEN' } }),
        prisma.trip.findMany({ select: { organizerId: true }, distinct: ['organizerId'] }).then((r) => r.length),
        prisma.rentalListing.findMany({ select: { hostId: true }, distinct: ['hostId'] }).then((r) => r.length),
        prisma.tripMember.count({ where: { status: 'PENDING' } }),
    ]);

    res.json({
        success: true,
        data: {
            users: userCount,
            bannedUsers: bannedCount,
            trips: tripCount,
            openTrips,
            tripOrganizers,
            vehicleHosts,
            pendingJoins,
            revenue: paymentTotal._sum.amount || 0,
            pendingVerifications,
            rides: rideCount,
            rentals: rentalCount,
            activeListings,
            pendingBookings,
        },
    });
});

// GET /api/admin/users
adminRouter.get('/users', async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = search
        ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phoneNumber: { contains: search, mode: 'insensitive' } },
            ],
        }
        : {};

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                role: true,
                isBanned: true,
                banReason: true,
                avatarUrl: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit),
        }),
        prisma.user.count({ where }),
    ]);

    res.json({ success: true, data: users, pagination: { page: Number(page), total } });
});

// PUT /api/admin/users/:id/role
adminRouter.put('/users/:id/role', async (req, res) => {
    const { role } = req.body;
    if (!ROLES.includes(role)) throw new AppError(`Role must be one of: ${ROLES.join(', ')}`, 400);
    if (req.params.id === req.user.id && role !== 'ADMIN') {
        throw new AppError('You cannot remove your own admin role.', 400);
    }

    const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { role },
        select: { id: true, name: true, role: true, isBanned: true },
    });

    await notifyUser({
        userId: user.id,
        type: 'SYSTEM',
        title: 'Role updated',
        body: `An admin set your role to ${role}.`,
        data: { role },
    });

    res.json({ success: true, data: user });
});

// PUT /api/admin/users/:id/ban
adminRouter.put('/users/:id/ban', async (req, res) => {
    const { isBanned, banReason } = req.body;
    if (typeof isBanned !== 'boolean') throw new AppError('isBanned must be true or false.', 400);
    if (req.params.id === req.user.id) throw new AppError('You cannot ban yourself.', 400);

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new AppError('User not found.', 404);
    if (target.role === 'ADMIN' && isBanned) {
        throw new AppError('Cannot ban another admin.', 400);
    }

    const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
            isBanned,
            banReason: isBanned ? (banReason?.trim() || 'Policy violation') : null,
            refreshToken: isBanned ? null : target.refreshToken,
        },
        select: { id: true, name: true, role: true, isBanned: true, banReason: true },
    });

    if (isBanned) {
        await notifyUser({
            userId: user.id,
            type: 'SYSTEM',
            title: 'Account suspended',
            body: user.banReason || 'Your account has been suspended.',
            data: { isBanned: true },
        });
    } else {
        await notifyUser({
            userId: user.id,
            type: 'SYSTEM',
            title: 'Account restored',
            body: 'Your account suspension has been lifted. You can use PickAndSync again.',
            data: { isBanned: false },
        });
    }

    res.json({ success: true, data: user });
});

// DELETE /api/admin/users/:id
adminRouter.delete('/users/:id', async (req, res) => {
    if (req.params.id === req.user.id) throw new AppError('You cannot delete your own account.', 400);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new AppError('User not found.', 404);
    if (target.role === 'ADMIN') throw new AppError('Cannot delete another admin.', 400);

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'User deleted.' });
});

// GET /api/admin/trips
adminRouter.get('/trips', async (req, res) => {
    const { page = 1, limit = 30, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {};
    if (status) where.status = String(status).toUpperCase();
    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { destination: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [trips, total] = await Promise.all([
        prisma.trip.findMany({
            where,
            include: {
                organizer: { select: { id: true, name: true, email: true, isBanned: true } },
                members: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                    orderBy: { joinedAt: 'asc' },
                },
                _count: { select: { members: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit),
        }),
        prisma.trip.count({ where }),
    ]);
    res.json({ success: true, data: trips, pagination: { page: Number(page), total } });
});

// GET /api/admin/hosts — trip organizers + vehicle hosts
adminRouter.get('/hosts', async (_req, res) => {
    const [tripHosts, vehicleHosts] = await Promise.all([
        prisma.user.findMany({
            where: { organizedTrips: { some: {} } },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                role: true,
                isBanned: true,
                _count: { select: { organizedTrips: true } },
            },
            orderBy: { name: 'asc' },
            take: 100,
        }),
        prisma.user.findMany({
            where: { rentalListings: { some: {} } },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                role: true,
                isBanned: true,
                _count: { select: { rentalListings: true, vehicles: true } },
            },
            orderBy: { name: 'asc' },
            take: 100,
        }),
    ]);

    res.json({
        success: true,
        data: {
            tripOrganizers: tripHosts,
            vehicleHosts,
        },
    });
});

// PATCH /api/admin/trips/:id — status / visibility control
adminRouter.patch('/trips/:id', async (req, res) => {
    const { status, isPublic } = req.body;
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) throw new AppError('Trip not found.', 404);

    const data = {};
    if (status !== undefined) {
        if (!TRIP_STATUSES.includes(status)) {
            throw new AppError(`Status must be one of: ${TRIP_STATUSES.join(', ')}`, 400);
        }
        data.status = status;
    }
    if (isPublic !== undefined) data.isPublic = Boolean(isPublic);
    if (!Object.keys(data).length) throw new AppError('Nothing to update.', 400);

    const updated = await prisma.trip.update({ where: { id: trip.id }, data });

    await notifyUser({
        userId: trip.organizerId,
        type: 'TRIP_UPDATE',
        title: 'Trip updated by admin',
        body: `Admin updated “${trip.title}”${data.status ? ` → ${data.status}` : ''}${data.isPublic !== undefined ? ` (${data.isPublic ? 'public' : 'private'})` : ''}.`,
        data: { tripId: trip.id, ...data },
    });

    res.json({ success: true, data: updated });
});

// PUT /api/admin/trips/:id/members/:userId — manage joiners
adminRouter.put('/trips/:id/members/:userId', async (req, res) => {
    const { status } = req.body;
    if (!MEMBER_STATUSES.includes(status)) {
        throw new AppError(`Status must be one of: ${MEMBER_STATUSES.join(', ')}`, 400);
    }

    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) throw new AppError('Trip not found.', 404);
    if (req.params.userId === trip.organizerId) {
        throw new AppError('Cannot change organizer membership this way.', 400);
    }

    const member = await prisma.tripMember.update({
        where: { tripId_userId: { tripId: trip.id, userId: req.params.userId } },
        data: { status },
        include: { user: { select: { id: true, name: true } } },
    });

    await notifyUser({
        userId: req.params.userId,
        type: 'TRIP_UPDATE',
        title: 'Trip membership updated',
        body: `Admin set your status on “${trip.title}” to ${status}.`,
        data: { tripId: trip.id, status },
    });

    res.json({ success: true, data: member });
});

// DELETE /api/admin/trips/:id
adminRouter.delete('/trips/:id', async (req, res) => {
    const trip = await prisma.trip.findUnique({
        where: { id: req.params.id },
        include: { members: { where: { status: 'APPROVED' }, select: { userId: true } } },
    });
    if (!trip) throw new AppError('Trip not found.', 404);

    const notifyIds = new Set([trip.organizerId, ...trip.members.map((m) => m.userId)]);
    await prisma.trip.delete({ where: { id: req.params.id } });

    await Promise.all(
        [...notifyIds].map((userId) =>
            notifyUser({
                userId,
                type: 'SYSTEM',
                title: 'Trip removed',
                body: `An admin removed the trip “${trip.title}”.`,
                data: { tripId: trip.id },
            })
        )
    );

    res.json({ success: true, message: 'Trip deleted.' });
});

// GET /api/admin/rentals/listings
adminRouter.get('/rentals/listings', async (req, res) => {
    const listings = await prisma.rentalListing.findMany({
        include: {
            vehicle: true,
            host: { select: { id: true, name: true, email: true } },
            _count: { select: { bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.json({ success: true, data: listings });
});

// PATCH /api/admin/rentals/listings/:id
adminRouter.patch('/rentals/listings/:id', async (req, res) => {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') throw new AppError('isActive must be true or false.', 400);

    const listing = await prisma.rentalListing.findUnique({
        where: { id: req.params.id },
        include: { vehicle: true },
    });
    if (!listing) throw new AppError('Listing not found.', 404);

    const updated = await prisma.rentalListing.update({
        where: { id: listing.id },
        data: { isActive },
    });

    await notifyUser({
        userId: listing.hostId,
        type: 'SYSTEM',
        title: isActive ? 'Listing reactivated' : 'Listing deactivated',
        body: isActive
            ? `Your listing for ${listing.vehicle.make} ${listing.vehicle.model} is active again.`
            : `An admin deactivated your listing for ${listing.vehicle.make} ${listing.vehicle.model}.`,
        data: { listingId: listing.id },
    });

    res.json({ success: true, data: updated });
});

// GET /api/admin/rentals/bookings
adminRouter.get('/rentals/bookings', async (req, res) => {
    const { status } = req.query;
    const where = status ? { status: String(status).toUpperCase() } : {};
    const bookings = await prisma.rentalBooking.findMany({
        where,
        include: {
            renter: { select: { id: true, name: true, email: true } },
            listing: {
                include: {
                    vehicle: true,
                    host: { select: { id: true, name: true, email: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.json({ success: true, data: bookings });
});

// PATCH /api/admin/rentals/bookings/:id
adminRouter.patch('/rentals/bookings/:id', async (req, res) => {
    const { status } = req.body;
    if (!BOOKING_STATUSES.includes(status)) {
        throw new AppError(`Status must be one of: ${BOOKING_STATUSES.join(', ')}`, 400);
    }

    const booking = await prisma.rentalBooking.findUnique({
        where: { id: req.params.id },
        include: { listing: { include: { vehicle: true } } },
    });
    if (!booking) throw new AppError('Booking not found.', 404);

    const updated = await prisma.rentalBooking.update({
        where: { id: booking.id },
        data: { status },
        include: {
            renter: { select: { id: true, name: true } },
            listing: { include: { vehicle: true, host: { select: { id: true, name: true } } } },
        },
    });

    const label = `${booking.listing.vehicle.make} ${booking.listing.vehicle.model}`;
    await Promise.all([
        notifyUser({
            userId: booking.renterId,
            type: 'SYSTEM',
            title: 'Booking updated by admin',
            body: `Your booking for ${label} is now ${status}.`,
            data: { bookingId: booking.id, status },
        }),
        notifyUser({
            userId: booking.listing.hostId,
            type: 'SYSTEM',
            title: 'Booking updated by admin',
            body: `Booking for ${label} is now ${status}.`,
            data: { bookingId: booking.id, status },
        }),
    ]);

    res.json({ success: true, data: updated });
});

// GET /api/admin/payments
adminRouter.get('/payments', async (req, res) => {
    const { status } = req.query;
    const where = status ? { status: String(status) } : {};
    const payments = await prisma.payment.findMany({
        where,
        include: {
            user: { select: { id: true, name: true, email: true } },
            trip: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.json({ success: true, data: payments });
});

// POST /api/admin/payments/:id/refund
adminRouter.post('/payments/:id/refund', async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) throw new AppError('Payment not found.', 404);
    if (payment.status === 'refunded') throw new AppError('Payment already refunded.', 400);
    if (payment.status !== 'succeeded') {
        throw new AppError('Only succeeded payments can be refunded.', 400);
    }

    const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'refunded' },
        include: { user: { select: { id: true, name: true } } },
    });

    // Best-effort: cancel matching PAID rental if local_pay_{bookingId}_...
    const localMatch = String(payment.stripePaymentId || '').match(/^local_pay_([0-9a-fA-F-]{36})_/);
    if (localMatch?.[1]) {
        const booking = await prisma.rentalBooking.findUnique({
            where: { id: localMatch[1] },
            include: { listing: { include: { vehicle: true } } },
        });
        if (booking && booking.status === 'PAID') {
            await prisma.rentalBooking.update({
                where: { id: booking.id },
                data: { status: 'CANCELLED' },
            });
            await notifyUser({
                userId: booking.listing.hostId,
                type: 'SYSTEM',
                title: 'Booking cancelled after refund',
                body: `Admin refunded payment for ${booking.listing.vehicle.make} ${booking.listing.vehicle.model}.`,
                data: { bookingId: booking.id, paymentId: payment.id },
            });
        }
    }

    await notifyUser({
        userId: payment.userId,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment refunded',
        body: `₹${Number(payment.amount).toLocaleString()} was refunded by an admin.`,
        data: { paymentId: payment.id },
    });

    res.json({ success: true, data: updated, message: 'Payment refunded.' });
});

// KYC + vehicles
adminRouter.get('/verifications', listVerifications);
adminRouter.put('/verifications/:id/approve', approveVerification);
adminRouter.put('/verifications/:id/reject', rejectVerification);
adminRouter.get('/vehicles', listVehiclesForReview);
adminRouter.put('/vehicles/:id/verify', verifyVehicle);
adminRouter.put('/vehicles/:id/reject', rejectVehicle);
