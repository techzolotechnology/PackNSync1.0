import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { canViewTrip } from '../utils/tripAccess.js';

export const itineraryRouter = Router();

/** Whitelist editable fields so the body cannot override tripId/id. */
function pickItemFields(body = {}, { requireCore = false } = {}) {
    const data = {};
    const str = (v, max) => (v === null || v === undefined ? v : String(v).slice(0, max));

    if (body.title !== undefined) data.title = str(body.title, 200);
    if (body.description !== undefined) data.description = str(body.description, 2000);
    if (body.location !== undefined) data.location = str(body.location, 300);
    if (body.startTime !== undefined) data.startTime = str(body.startTime, 20);
    if (body.endTime !== undefined) data.endTime = str(body.endTime, 20);
    if (body.type !== undefined) data.type = str(body.type, 40);
    if (body.dayNumber !== undefined) {
        const day = Number(body.dayNumber);
        if (!Number.isInteger(day) || day < 1 || day > 366) throw new AppError('dayNumber must be a positive whole number.', 400);
        data.dayNumber = day;
    }
    if (body.order !== undefined) {
        const order = Number(body.order);
        if (!Number.isInteger(order)) throw new AppError('order must be a whole number.', 400);
        data.order = order;
    }

    if (requireCore && (!data.title?.trim() || data.dayNumber === undefined)) {
        throw new AppError('Title and dayNumber are required.', 400);
    }
    return data;
}

async function assertOrganizer(tripId, user) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Trip not found.', 404);
    if (trip.organizerId !== user.id && user.role !== 'ADMIN') {
        throw new AppError('Only the organizer can edit the itinerary.', 403);
    }
    return trip;
}

async function assertItemInTrip(itemId, tripId) {
    const item = await prisma.itineraryItem.findUnique({ where: { id: itemId } });
    if (!item || item.tripId !== tripId) throw new AppError('Itinerary item not found.', 404);
    return item;
}

// GET /api/trips/:id/itinerary
itineraryRouter.get('/:id/itinerary', optionalAuth, async (req, res) => {
    const trip = await prisma.trip.findUnique({
        where: { id: req.params.id },
        include: { members: { select: { userId: true, status: true } } },
    });
    if (!trip || !canViewTrip(trip, req.user)) throw new AppError('Trip not found.', 404);

    const items = await prisma.itineraryItem.findMany({
        where: { tripId: req.params.id },
        orderBy: [{ dayNumber: 'asc' }, { order: 'asc' }],
    });
    res.json({ success: true, data: items });
});

// POST /api/trips/:id/itinerary
itineraryRouter.post('/:id/itinerary', authenticate, async (req, res) => {
    await assertOrganizer(req.params.id, req.user);

    const item = await prisma.itineraryItem.create({
        data: { ...pickItemFields(req.body, { requireCore: true }), tripId: req.params.id },
    });
    res.status(201).json({ success: true, data: item });
});

// PUT /api/trips/:id/itinerary/:itemId
itineraryRouter.put('/:id/itinerary/:itemId', authenticate, async (req, res) => {
    await assertOrganizer(req.params.id, req.user);
    await assertItemInTrip(req.params.itemId, req.params.id);

    const item = await prisma.itineraryItem.update({
        where: { id: req.params.itemId },
        data: pickItemFields(req.body),
    });
    res.json({ success: true, data: item });
});

// DELETE /api/trips/:id/itinerary/:itemId
itineraryRouter.delete('/:id/itinerary/:itemId', authenticate, async (req, res) => {
    await assertOrganizer(req.params.id, req.user);
    await assertItemInTrip(req.params.itemId, req.params.id);

    await prisma.itineraryItem.delete({ where: { id: req.params.itemId } });
    res.json({ success: true, message: 'Item removed.' });
});
