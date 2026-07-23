import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
    listVerifications,
    approveVerification,
    rejectVerification,
    listVehiclesForReview,
    verifyVehicle,
} from '../controllers/adminVerification.controller.js';

export const adminRouter = Router();

// All admin routes require ADMIN role
adminRouter.use(authenticate, authorize('ADMIN'));

// GET /api/admin/stats
adminRouter.get('/stats', async (_req, res) => {
    const [userCount, tripCount, paymentTotal, pendingVerifications, rideCount, rentalCount] = await Promise.all([
        prisma.user.count(),
        prisma.trip.count(),
        prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'succeeded' } }),
        prisma.verification.count({ where: { status: 'PENDING' } }),
        prisma.rideBooking.count(),
        prisma.rentalBooking.count(),
    ]);

    res.json({
        success: true,
        data: {
            users: userCount,
            trips: tripCount,
            revenue: paymentTotal._sum.amount || 0,
            pendingVerifications,
            rides: rideCount,
            rentals: rentalCount,
        },
    });
});

// GET /api/admin/users
adminRouter.get('/users', async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }
        : {};

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            skip, take: Number(limit),
        }),
        prisma.user.count({ where }),
    ]);

    res.json({ success: true, data: users, pagination: { page: Number(page), total } });
});

// PUT /api/admin/users/:id/role
adminRouter.put('/users/:id/role', async (req, res) => {
    const { role } = req.body;
    const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { role },
        select: { id: true, name: true, role: true },
    });
    res.json({ success: true, data: user });
});

// DELETE /api/admin/users/:id
adminRouter.delete('/users/:id', async (req, res) => {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'User deleted.' });
});

// GET /api/admin/trips
adminRouter.get('/trips', async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [trips, total] = await Promise.all([
        prisma.trip.findMany({
            include: { organizer: { select: { id: true, name: true } }, _count: { select: { members: true } } },
            orderBy: { createdAt: 'desc' },
            skip, take: Number(limit),
        }),
        prisma.trip.count(),
    ]);
    res.json({ success: true, data: trips, pagination: { page: Number(page), total } });
});

// DELETE /api/admin/trips/:id
adminRouter.delete('/trips/:id', async (req, res) => {
    await prisma.trip.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Trip deleted.' });
});

// KYC review
adminRouter.get('/verifications', listVerifications);
adminRouter.put('/verifications/:id/approve', approveVerification);
adminRouter.put('/verifications/:id/reject', rejectVerification);
adminRouter.get('/vehicles', listVehiclesForReview);
adminRouter.put('/vehicles/:id/verify', verifyVehicle);
