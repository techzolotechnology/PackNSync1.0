import { prisma } from './prisma.js';
import { AppError } from './AppError.js';

/** Organizer, approved member, or admin. */
export const isTripParticipant = (trip, user) => {
    if (!user) return false;
    if (user.role === 'ADMIN' || trip.organizerId === user.id) return true;
    return (trip.members || []).some((m) => m.userId === user.id && m.status === 'APPROVED');
};

/**
 * Load a trip with its approved members and require the user to be a participant.
 * Throws 404 when the trip does not exist, 403 otherwise.
 */
export const assertTripParticipant = async (tripId, user) => {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        include: { members: { where: { status: 'APPROVED' }, select: { userId: true, status: true } } },
    });
    if (!trip) throw new AppError('Trip not found.', 404);
    if (!isTripParticipant(trip, user)) {
        throw new AppError('Only the organizer and approved members can access this trip.', 403);
    }
    return trip;
};

/**
 * Private trips are visible only to participants and to users with a pending
 * join request (so they can see what they asked to join).
 */
export const canViewTrip = (trip, user) => {
    if (trip.isPublic) return true;
    if (!user) return false;
    if (isTripParticipant(trip, user)) return true;
    return (trip.members || []).some((m) => m.userId === user.id && m.status === 'PENDING');
};
