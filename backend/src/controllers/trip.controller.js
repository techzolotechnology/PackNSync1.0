import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { notifyUser } from '../utils/notify.js';
import { assertFullyVerified, getUserVerificationState } from '../utils/verificationHelpers.js';
import { findSuggestedCars } from '../utils/carSuggestions.js';
import { fetchCoverSuggestions } from '../utils/coverSuggestions.js';

async function withVerificationFlags(trip) {
    const userIds = [
        trip.organizerId,
        ...(trip.members || []).map((m) => m.userId),
    ].filter(Boolean);
    const uniqueIds = [...new Set(userIds)];
    const states = await Promise.all(uniqueIds.map((id) => getUserVerificationState(id)));
    const verifiedMap = Object.fromEntries(
        uniqueIds.map((id, i) => [id, states[i].isFullyVerified])
    );

    return {
        ...trip,
        organizer: trip.organizer
            ? { ...trip.organizer, isVerified: Boolean(verifiedMap[trip.organizerId]) }
            : trip.organizer,
        members: (trip.members || []).map((m) => ({
            ...m,
            user: m.user
                ? { ...m.user, isVerified: Boolean(verifiedMap[m.userId]) }
                : m.user,
        })),
    };
}

const tripListInclude = {
    organizer: { select: { id: true, name: true, avatarUrl: true } },
    members: {
        where: { status: 'APPROVED' },
        take: 4,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { joinedAt: 'asc' },
    },
    _count: { select: { members: { where: { status: 'APPROVED' } } } },
};

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
            include: tripListInclude,
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

// GET /api/trips/mine — trips the current user organizes or has joined (approved)
export const getMyOrganizedTrips = async (req, res) => {
    const { status, search, page = 1, limit = 12 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const userId = req.user.id;

    const where = {
        OR: [
            { organizerId: userId },
            { members: { some: { userId, status: 'APPROVED' } } },
        ],
    };
    if (status) where.status = status;
    if (search) {
        where.AND = [{
            OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { destination: { contains: search, mode: 'insensitive' } },
            ],
        }];
    }

    const [trips, total] = await Promise.all([
        prisma.trip.findMany({
            where,
            include: tripListInclude,
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit),
        }),
        prisma.trip.count({ where }),
    ]);

    const data = trips.map((trip) => ({
        ...trip,
        myRole: trip.organizerId === userId ? 'ORGANIZER' : 'MEMBER',
    }));

    res.json({
        success: true,
        data,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
};

// GET /api/trips/cover-suggestions?q=Coorg
export const getCoverSuggestions = async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
        throw new AppError('Enter a destination to load cover suggestions.', 400);
    }
    const suggestions = await fetchCoverSuggestions(q, 4);
    res.json({ success: true, data: suggestions, query: q });
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
            announcements: {
                orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
                take: 50,
                include: { author: { select: { id: true, name: true, avatarUrl: true } } },
            },
        },
    });

    if (!trip) throw new AppError('Trip not found.', 404);
    res.json({ success: true, data: await withVerificationFlags(trip) });
};

// GET /api/trips/:id/car-suggestions
export const getTripCarSuggestions = async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) throw new AppError('Trip not found.', 404);

    const result = await findSuggestedCars(prisma, {
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        seats: trip.maxParticipants,
        limit: req.query.limit || 6,
        excludeHostId: req.user?.id || null,
    });

    res.json({
        success: true,
        data: result.suggestions,
        meta: {
            ...result.meta,
            tripId: trip.id,
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate,
            seats: trip.maxParticipants,
        },
    });
};

// POST /api/trips
export const createTrip = async (req, res) => {
    const {
        title, description, destination, startDate, endDate,
        maxParticipants, budgetEstimate, isPublic, coverImageUrl,
    } = req.body;

    const trip = await prisma.trip.create({
        data: {
            title, description, destination, isPublic: isPublic ?? true,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            maxParticipants: Number(maxParticipants) || 10,
            budgetEstimate: budgetEstimate ? Number(budgetEstimate) : null,
            coverImageUrl: coverImageUrl || null,
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

const toDateKey = (value) => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

const formatTripDate = (value) => {
    const key = toDateKey(value);
    if (!key) return '—';
    return new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

// PUT /api/trips/:id
export const updateTrip = async (req, res) => {
    const trip = await prisma.trip.findUnique({
        where: { id: req.params.id },
        include: {
            members: { where: { status: 'APPROVED' }, select: { userId: true } },
        },
    });
    if (!trip) throw new AppError('Trip not found.', 404);
    if (trip.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('Only the organizer can update this trip.', 403);
    }

    const {
        title,
        description,
        destination,
        startDate,
        endDate,
        maxParticipants,
        budgetEstimate,
        status,
        isPublic,
        coverImageUrl,
    } = req.body;

    const data = {};
    const changes = [];

    if (title !== undefined) {
        const next = String(title).trim();
        if (!next) throw new AppError('Title is required.', 400);
        if (next !== trip.title) {
            data.title = next;
            changes.push(`title → “${next}”`);
        }
    }

    if (description !== undefined) {
        const next = description == null ? null : String(description).trim() || null;
        if (next !== trip.description) {
            data.description = next;
            changes.push('description updated');
        }
    }

    if (destination !== undefined) {
        const next = String(destination).trim();
        if (!next) throw new AppError('Destination is required.', 400);
        if (next !== trip.destination) {
            data.destination = next;
            changes.push(`destination → ${next}`);
        }
    }

    if (startDate !== undefined || endDate !== undefined) {
        const nextStart = startDate !== undefined ? new Date(startDate) : trip.startDate;
        const nextEnd = endDate !== undefined ? new Date(endDate) : trip.endDate;
        if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
            throw new AppError('Valid start and end dates are required.', 400);
        }
        if (nextEnd < nextStart) throw new AppError('End date must be on or after start date.', 400);

        if (toDateKey(nextStart) !== toDateKey(trip.startDate)) {
            data.startDate = nextStart;
            changes.push(`start date → ${formatTripDate(nextStart)}`);
        }
        if (toDateKey(nextEnd) !== toDateKey(trip.endDate)) {
            data.endDate = nextEnd;
            changes.push(`end date → ${formatTripDate(nextEnd)}`);
        }
    }

    if (maxParticipants !== undefined) {
        const next = Number(maxParticipants);
        if (!Number.isInteger(next) || next < 2) {
            throw new AppError('Member limit must be an integer of at least 2.', 400);
        }
        const approvedCount = trip.members.length;
        if (next < approvedCount) {
            throw new AppError(`Member limit cannot be below current members (${approvedCount}).`, 400);
        }
        if (next !== trip.maxParticipants) {
            data.maxParticipants = next;
            changes.push(`member limit → ${next}`);
        }
    }

    if (budgetEstimate !== undefined) {
        const next = budgetEstimate === null || budgetEstimate === ''
            ? null
            : Number(budgetEstimate);
        if (next !== null && (!(next > 0) || Number.isNaN(next))) {
            throw new AppError('Budget estimate must be a positive number.', 400);
        }
        if (next !== trip.budgetEstimate) {
            data.budgetEstimate = next;
            changes.push(
                next == null
                    ? 'budget estimate cleared'
                    : `budget → ~₹${Number(next).toLocaleString('en-IN')} / person`
            );
        }
    }

    if (status !== undefined) {
        const allowed = ['DRAFT', 'OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
        if (!allowed.includes(status)) throw new AppError('Invalid trip status.', 400);
        if (status !== trip.status) {
            data.status = status;
            changes.push(`status → ${status}`);
        }
    }

    if (isPublic !== undefined) {
        const next = Boolean(isPublic);
        if (next !== trip.isPublic) {
            data.isPublic = next;
            changes.push(next ? 'trip set to public' : 'trip set to private');
        }
    }

    if (coverImageUrl !== undefined && coverImageUrl !== trip.coverImageUrl) {
        data.coverImageUrl = coverImageUrl || null;
        changes.push('cover image updated');
    }

    if (Object.keys(data).length === 0) {
        return res.json({ success: true, data: trip, message: 'No changes detected.' });
    }

    // Auto-adjust OPEN/FULL when member limit changes
    if (data.maxParticipants !== undefined && !data.status) {
        const approvedCount = trip.members.length;
        if (data.maxParticipants <= approvedCount && trip.status === 'OPEN') {
            data.status = 'FULL';
            changes.push('status → FULL');
        } else if (data.maxParticipants > approvedCount && trip.status === 'FULL') {
            data.status = 'OPEN';
            changes.push('status → OPEN');
        }
    }

    const updated = await prisma.trip.update({
        where: { id: trip.id },
        data,
        include: {
            organizer: { select: { id: true, name: true, avatarUrl: true, bio: true } },
        },
    });

    const recipientIds = new Set(trip.members.map((m) => m.userId));
    recipientIds.delete(req.user.id);

    const summary = changes.slice(0, 4).join('; ');
    await Promise.all(
        [...recipientIds].map((userId) =>
            notifyUser({
                userId,
                type: 'TRIP_UPDATE',
                title: 'Trip details updated',
                body: `${req.user.name} updated “${updated.title}”: ${summary}.`,
                data: { tripId: trip.id, changes },
            })
        )
    );

    const io = req.app.get('io');
    io?.to(`trip:${trip.id}`).emit('trip_updated', {
        tripId: trip.id,
        changes,
        trip: updated,
    });

    res.json({ success: true, data: updated, changes });
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
    await assertFullyVerified(req.user.id);

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
    if (existing && !['REJECTED', 'LEFT'].includes(existing.status)) {
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

    // Notify organizer via Socket.IO + in-app
    const io = req.app.get('io');
    io?.to(`user:${trip.organizerId}`).emit('join_request', {
        tripId: trip.id, tripTitle: trip.title,
        user: { id: req.user.id, name: req.user.name, avatarUrl: req.user.avatarUrl },
    });
    await notifyUser({
        userId: trip.organizerId,
        type: 'JOIN_REQUEST',
        title: 'New join request',
        body: `${req.user.name} wants to join “${trip.title}”.`,
        data: { tripId: trip.id, userId: req.user.id },
    });

    res.status(201).json({ success: true, data: member });
};

// POST /api/trips/:id/leave — traveler leaves or withdraws request
export const leaveTrip = async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) throw new AppError('Trip not found.', 404);
    if (trip.organizerId === req.user.id) {
        throw new AppError('Organizers cannot leave their own trip. Delete or cancel it instead.', 400);
    }

    const existing = await prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId: trip.id, userId: req.user.id } },
    });
    if (!existing || existing.status === 'LEFT') {
        throw new AppError('You are not an active member of this trip.', 400);
    }

    const member = await prisma.tripMember.update({
        where: { tripId_userId: { tripId: trip.id, userId: req.user.id } },
        data: { status: 'LEFT' },
    });

    await notifyUser({
        userId: trip.organizerId,
        type: 'TRIP_UPDATE',
        title: 'Member left',
        body: `${req.user.name} left “${trip.title}”.`,
        data: { tripId: trip.id, userId: req.user.id },
    });

    res.json({ success: true, data: member });
};

// PUT /api/trips/:id/members/:userId
export const updateMemberStatus = async (req, res) => {
    const { id: tripId, userId } = req.params;
    const { status } = req.body; // APPROVED | REJECTED | LEFT (remove)

    if (!['APPROVED', 'REJECTED', 'LEFT'].includes(status)) {
        throw new AppError('Status must be APPROVED, REJECTED, or LEFT.', 400);
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Trip not found.', 404);
    if (trip.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('Only the organizer can manage members.', 403);
    }
    if (userId === trip.organizerId) {
        throw new AppError('Organizer cannot be removed from the trip.', 400);
    }

    const existing = await prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId } },
    });
    if (!existing) throw new AppError('Member not found on this trip.', 404);

    if (status === 'LEFT' && !['APPROVED', 'PENDING'].includes(existing.status)) {
        throw new AppError('Only pending or approved members can be removed.', 400);
    }

    const member = await prisma.tripMember.update({
        where: { tripId_userId: { tripId, userId } },
        data: { status },
    });

    // Free a seat if trip was full
    if (status === 'LEFT' && trip.status === 'FULL') {
        const approvedCount = await prisma.tripMember.count({
            where: { tripId, status: 'APPROVED' },
        });
        if (approvedCount < trip.maxParticipants) {
            await prisma.trip.update({ where: { id: tripId }, data: { status: 'OPEN' } });
        }
    }

    const io = req.app.get('io');
    io?.to(`user:${userId}`).emit('membership_update', { tripId, tripTitle: trip.title, status });

    if (status === 'LEFT') {
        await notifyUser({
            userId,
            type: 'TRIP_UPDATE',
            title: 'Removed from trip',
            body: `You were removed from “${trip.title}” by the organizer.`,
            data: { tripId },
        });
    } else {
        await notifyUser({
            userId,
            type: status === 'APPROVED' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
            title: status === 'APPROVED' ? 'Join request approved' : 'Join request declined',
            body: status === 'APPROVED'
                ? `You’re in for “${trip.title}”. Open the trip to split expenses.`
                : `Your request to join “${trip.title}” was declined.`,
            data: { tripId },
        });
    }

    res.json({ success: true, data: member });
};

// POST /api/trips/:id/announcements — organizer posts an announcement
export const createAnnouncement = async (req, res) => {
    const { title, content, isPinned } = req.body;
    if (!title?.trim() || !content?.trim()) {
        throw new AppError('Title and content are required.', 400);
    }

    const trip = await prisma.trip.findUnique({
        where: { id: req.params.id },
        include: {
            members: { where: { status: 'APPROVED' }, select: { userId: true } },
        },
    });
    if (!trip) throw new AppError('Trip not found.', 404);
    if (trip.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('Only the organizer can post announcements.', 403);
    }

    const announcement = await prisma.announcement.create({
        data: {
            tripId: trip.id,
            authorId: req.user.id,
            title: title.trim(),
            content: content.trim(),
            isPinned: Boolean(isPinned),
        },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const recipientIds = new Set(trip.members.map((m) => m.userId));
    recipientIds.delete(req.user.id);

    await Promise.all(
        [...recipientIds].map((userId) =>
            notifyUser({
                userId,
                type: 'TRIP_UPDATE',
                title: `Announcement: ${announcement.title}`,
                body: `${req.user.name} posted on “${trip.title}”: ${announcement.content.slice(0, 120)}${announcement.content.length > 120 ? '…' : ''}`,
                data: { tripId: trip.id, announcementId: announcement.id },
            })
        )
    );

    const io = req.app.get('io');
    io?.to(`trip:${trip.id}`).emit('announcement', {
        tripId: trip.id,
        announcement,
    });

    res.status(201).json({ success: true, data: announcement });
};

// DELETE /api/trips/:id/announcements/:announcementId
export const deleteAnnouncement = async (req, res) => {
    const announcement = await prisma.announcement.findUnique({
        where: { id: req.params.announcementId },
        include: { trip: { select: { id: true, organizerId: true } } },
    });
    if (!announcement || announcement.tripId !== req.params.id) {
        throw new AppError('Announcement not found.', 404);
    }
    if (
        announcement.authorId !== req.user.id
        && announcement.trip.organizerId !== req.user.id
        && req.user.role !== 'ADMIN'
    ) {
        throw new AppError('Only the author or organizer can delete this announcement.', 403);
    }

    await prisma.announcement.delete({ where: { id: announcement.id } });
    res.json({ success: true, message: 'Announcement deleted.' });
};

async function assertTripChatAccess(tripId, userId, role) {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: {
            id: true,
            organizerId: true,
            members: {
                where: { userId, status: 'APPROVED' },
                select: { id: true },
                take: 1,
            },
        },
    });
    if (!trip) throw new AppError('Trip not found.', 404);
    const allowed = role === 'ADMIN'
        || trip.organizerId === userId
        || trip.members.length > 0;
    if (!allowed) {
        throw new AppError('Only the organizer and approved members can access trip chat.', 403);
    }
    return trip;
}

// GET /api/trips/:id/messages — chat history for organizer / approved members
export const getTripMessages = async (req, res) => {
    await assertTripChatAccess(req.params.id, req.user.id, req.user.role);

    const take = Math.min(Number(req.query.limit) || 100, 200);
    const messages = await prisma.message.findMany({
        where: { tripId: req.params.id },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
        take,
    });

    res.json({ success: true, data: messages });
};

// GET /api/trips/chat-unread — unread chat counts for the current user
export const getChatUnread = async (req, res) => {
    const userId = req.user.id;

    const [organized, memberships, reads] = await Promise.all([
        prisma.trip.findMany({
            where: { organizerId: userId },
            select: { id: true, title: true },
        }),
        prisma.tripMember.findMany({
            where: { userId, status: 'APPROVED' },
            select: { trip: { select: { id: true, title: true } } },
        }),
        prisma.tripChatRead.findMany({
            where: { userId },
            select: { tripId: true, lastReadAt: true },
        }),
    ]);

    const tripMap = new Map();
    for (const t of organized) tripMap.set(t.id, t.title);
    for (const m of memberships) tripMap.set(m.trip.id, m.trip.title);

    const readMap = Object.fromEntries(reads.map((r) => [r.tripId, r.lastReadAt]));
    const byTrip = [];
    let total = 0;

    for (const [tripId, title] of tripMap.entries()) {
        const lastReadAt = readMap[tripId] || new Date(0);
        const count = await prisma.message.count({
            where: {
                tripId,
                userId: { not: userId },
                createdAt: { gt: lastReadAt },
            },
        });
        if (count > 0) {
            byTrip.push({ tripId, title, count });
            total += count;
        }
    }

    res.json({ success: true, data: { total, byTrip } });
};

// POST /api/trips/:id/messages/read — mark trip chat as read
export const markTripChatRead = async (req, res) => {
    await assertTripChatAccess(req.params.id, req.user.id, req.user.role);
    const now = new Date();

    const row = await prisma.tripChatRead.upsert({
        where: {
            tripId_userId: { tripId: req.params.id, userId: req.user.id },
        },
        create: {
            tripId: req.params.id,
            userId: req.user.id,
            lastReadAt: now,
        },
        update: { lastReadAt: now },
    });

    res.json({ success: true, data: row });
};
