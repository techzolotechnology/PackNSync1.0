import { prisma } from '../utils/prisma.js';

/** tripId -> Map(userId -> Set(socketId)) */
const tripPresence = new Map();

function getTripPresenceUserIds(tripId) {
    const users = tripPresence.get(tripId);
    return users ? [...users.keys()] : [];
}

function addPresence(tripId, userId, socketId) {
    if (!tripPresence.has(tripId)) tripPresence.set(tripId, new Map());
    const users = tripPresence.get(tripId);
    if (!users.has(userId)) users.set(userId, new Set());
    users.get(userId).add(socketId);
}

function removePresence(tripId, userId, socketId) {
    const users = tripPresence.get(tripId);
    if (!users) return false;
    const sockets = users.get(userId);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) users.delete(userId);
    if (users.size === 0) tripPresence.delete(tripId);
    return true;
}

function removeSocketFromAllTrips(socketId, userId) {
    const changed = [];
    for (const [tripId, users] of tripPresence.entries()) {
        const sockets = users.get(userId);
        if (!sockets?.has(socketId)) continue;
        removePresence(tripId, userId, socketId);
        changed.push(tripId);
    }
    return changed;
}

async function canAccessTripChat(tripId, userId) {
    if (!tripId || !userId) return false;
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: {
            organizerId: true,
            members: {
                where: { userId, status: 'APPROVED' },
                select: { id: true },
                take: 1,
            },
        },
    });
    if (!trip) return false;
    return trip.organizerId === userId || trip.members.length > 0;
}

async function getTripChatRecipientIds(tripId, excludeUserId) {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: {
            organizerId: true,
            members: {
                where: { status: 'APPROVED' },
                select: { userId: true },
            },
        },
    });
    if (!trip) return [];
    const ids = new Set([trip.organizerId, ...trip.members.map((m) => m.userId)]);
    ids.delete(excludeUserId);
    return [...ids];
}

export const registerSocketHandlers = (io) => {
    io.use(async (socket, next) => {
        const userId = socket.handshake.auth?.userId;
        if (!userId) return next(new Error('Unauthenticated'));
        socket.userId = userId;
        next();
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.userId})`);
        socket.join(`user:${socket.userId}`);

        socket.on('join_trip_room', async (tripId) => {
            try {
                const allowed = await canAccessTripChat(tripId, socket.userId);
                if (!allowed) {
                    socket.emit('error', { message: 'Not allowed to join this trip chat.' });
                    return;
                }
                socket.join(`trip:${tripId}`);
                addPresence(tripId, socket.userId, socket.id);
                const onlineUserIds = getTripPresenceUserIds(tripId);
                io.to(`trip:${tripId}`).emit('trip_presence', { tripId, onlineUserIds });
            } catch (err) {
                socket.emit('error', { message: 'Failed to join trip chat.' });
            }
        });

        socket.on('leave_trip_room', (tripId) => {
            socket.leave(`trip:${tripId}`);
            removePresence(tripId, socket.userId, socket.id);
            io.to(`trip:${tripId}`).emit('trip_presence', {
                tripId,
                onlineUserIds: getTripPresenceUserIds(tripId),
            });
        });

        socket.on('send_message', async ({ tripId, content, clientTempId }) => {
            if (!tripId || !content?.trim()) return;

            try {
                const allowed = await canAccessTripChat(tripId, socket.userId);
                if (!allowed) {
                    socket.emit('error', {
                        message: 'Not allowed to send messages in this trip.',
                        clientTempId,
                    });
                    return;
                }

                const message = await prisma.message.create({
                    data: {
                        tripId,
                        userId: socket.userId,
                        content: content.trim().slice(0, 2000),
                    },
                    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                });

                const payload = { ...message, clientTempId: clientTempId || null };
                io.to(`trip:${tripId}`).emit('new_message', payload);

                const recipients = await getTripChatRecipientIds(tripId, socket.userId);
                for (const userId of recipients) {
                    io.to(`user:${userId}`).emit('chat_activity', {
                        tripId,
                        message: payload,
                    });
                }
            } catch (err) {
                socket.emit('error', {
                    message: 'Failed to send message.',
                    clientTempId,
                });
            }
        });

        socket.on('typing', ({ tripId, isTyping }) => {
            if (!tripId || !socket.rooms.has(`trip:${tripId}`)) return;
            socket.to(`trip:${tripId}`).emit('user_typing', {
                userId: socket.userId,
                isTyping,
            });
        });

        socket.on('vote', async ({ pollId, selectedOption, tripId }) => {
            try {
                await prisma.pollVote.upsert({
                    where: { pollId_userId: { pollId, userId: socket.userId } },
                    update: { selectedOption },
                    create: { pollId, userId: socket.userId, selectedOption },
                });

                const votes = await prisma.pollVote.findMany({ where: { pollId } });
                io.to(`trip:${tripId}`).emit('poll_updated', { pollId, votes });
            } catch (err) {
                socket.emit('error', { message: 'Failed to record vote.' });
            }
        });

        socket.on('disconnect', () => {
            const changedTrips = removeSocketFromAllTrips(socket.id, socket.userId);
            for (const tripId of changedTrips) {
                io.to(`trip:${tripId}`).emit('trip_presence', {
                    tripId,
                    onlineUserIds: getTripPresenceUserIds(tripId),
                });
            }
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });
};
