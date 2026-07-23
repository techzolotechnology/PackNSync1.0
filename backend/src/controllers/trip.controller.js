import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';

// GET /api/trips
export const getTrips = async (req, res) => {
    const { destination, status, search, page = 1, limit = 12 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { isPublic: true };
    if (destination) where.destination = { contains: destination, mode: 'insensitive' };
    if (status) where.status = status;
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
                organizer: { select: { id: true, name: true, avatarUrl: true } },
                members: {
                    where: { status: 'APPROVED' },
                    take: 4,
                    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                    orderBy: { joinedAt: 'asc' },
                },
                _count: { select: { members: { where: { status: 'APPROVED' } } } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit),
        }),
        prisma.trip.count({ where }),
    ]);

    res.json({
        success: true,
        data: trips,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
};

// GET /api/trips/:id
export const getTripById = async (req, res) => {
    const trip = await prisma.trip.findUnique({
        where: { id: req.params.id },
        include: {
            organizer: { select: { id: true, name: true, avatarUrl: true, bio: true } },
            members: {
                include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                orderBy: { joinedAt: 'asc' },
            },
            itineraryItems: { orderBy: [{ dayNumber: 'asc' }, { order: 'asc' }] },
            announcements: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
    });

    if (!trip) throw new AppError('Trip not found.', 404);
    res.json({ success: true, data: trip });
};

// POST /api/trips
export const createTrip = async (req, res) => {
    const { title, description, destination, startDate, endDate, maxParticipants, budgetEstimate, isPublic } = req.body;

    const trip = await prisma.trip.create({
        data: {
            title, description, destination, isPublic: isPublic ?? true,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            maxParticipants: Number(maxParticipants) || 10,
            budgetEstimate: budgetEstimate ? Number(budgetEstimate) : null,
            status: 'OPEN',
            organizerId: req.user.id,
        },
        include: { organizer: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Auto-add organizer as approved member
    await prisma.tripMember.create({
        data: { tripId: trip.id, userId: req.user.id, status: 'APPROVED' },
    });

    res.status(201).json({ success: true, data: trip });
};

// PUT /api/trips/:id
export const updateTrip = async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) throw new AppError('Trip not found.', 404);
    if (trip.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('Only the organizer can update this trip.', 403);
    }

    const updated = await prisma.trip.update({
        where: { id: req.params.id },
        data: req.body,
    });

    res.json({ success: true, data: updated });
};

// DELETE /api/trips/:id
export const deleteTrip = async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) throw new AppError('Trip not found.', 404);
    if (trip.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('Only the organizer can delete this trip.', 403);
    }

    await prisma.trip.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Trip deleted.' });
};

// POST /api/trips/:id/join
export const requestToJoin = async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) throw new AppError('Trip not found.', 404);
    if (trip.organizerId === req.user.id) throw new AppError('Organizers cannot request to join.', 400);
    if (!['OPEN', 'DRAFT'].includes(trip.status)) {
        throw new AppError('This trip is not accepting new members.', 400);
    }
    if (trip.status === 'DRAFT') {
        // Public draft trips can still be joined; promote to OPEN on first join interest
        await prisma.trip.update({ where: { id: trip.id }, data: { status: 'OPEN' } });
    }

    const existing = await prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId: req.params.id, userId: req.user.id } },
    });
    if (existing && existing.status !== 'REJECTED') {
        throw new AppError(`You already have a ${existing.status.toLowerCase()} membership.`, 409);
    }

    const member = existing
        ? await prisma.tripMember.update({
            where: { tripId_userId: { tripId: req.params.id, userId: req.user.id } },
            data: { status: 'PENDING' },
        })
        : await prisma.tripMember.create({
            data: { tripId: req.params.id, userId: req.user.id, status: 'PENDING' },
        });

    // Notify organizer via Socket.IO
    const io = req.app.get('io');
    io?.to(`user:${trip.organizerId}`).emit('join_request', {
        tripId: trip.id, tripTitle: trip.title,
        user: { id: req.user.id, name: req.user.name, avatarUrl: req.user.avatarUrl },
    });

    res.status(201).json({ success: true, data: member });
};

// PUT /api/trips/:id/members/:userId
export const updateMemberStatus = async (req, res) => {
    const { id: tripId, userId } = req.params;
    const { status } = req.body; // APPROVED | REJECTED

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Trip not found.', 404);
    if (trip.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('Only the organizer can manage members.', 403);
    }

    const member = await prisma.tripMember.update({
        where: { tripId_userId: { tripId, userId } },
        data: { status },
    });

    // Notify the member
    const io = req.app.get('io');
    io?.to(`user:${userId}`).emit('membership_update', { tripId, tripTitle: trip.title, status });

    res.json({ success: true, data: member });
};
