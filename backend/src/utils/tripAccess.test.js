import { describe, it, expect, vi } from 'vitest';

vi.mock('./prisma.js', () => ({ prisma: {} }));

const { canViewTrip, isTripParticipant } = await import('./tripAccess.js');

const trip = (overrides = {}) => ({
    organizerId: 'org',
    isPublic: false,
    members: [
        { userId: 'member', status: 'APPROVED' },
        { userId: 'pending', status: 'PENDING' },
        { userId: 'rejected', status: 'REJECTED' },
    ],
    ...overrides,
});

describe('trip access', () => {
    it('treats organizer, approved members and admins as participants', () => {
        expect(isTripParticipant(trip(), { id: 'org' })).toBe(true);
        expect(isTripParticipant(trip(), { id: 'member' })).toBe(true);
        expect(isTripParticipant(trip(), { id: 'someone', role: 'ADMIN' })).toBe(true);
        expect(isTripParticipant(trip(), { id: 'pending' })).toBe(false);
        expect(isTripParticipant(trip(), { id: 'rejected' })).toBe(false);
        expect(isTripParticipant(trip(), null)).toBe(false);
    });

    it('hides private trips from outsiders and anonymous users', () => {
        expect(canViewTrip(trip(), null)).toBe(false);
        expect(canViewTrip(trip(), { id: 'stranger' })).toBe(false);
        expect(canViewTrip(trip(), { id: 'rejected' })).toBe(false);
    });

    it('shows private trips to participants and pending requesters', () => {
        expect(canViewTrip(trip(), { id: 'member' })).toBe(true);
        expect(canViewTrip(trip(), { id: 'pending' })).toBe(true);
    });

    it('shows public trips to everyone', () => {
        expect(canViewTrip(trip({ isPublic: true }), null)).toBe(true);
    });
});
