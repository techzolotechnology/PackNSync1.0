import { describe, it, expect, vi } from 'vitest';

const findUnique = vi.fn();
vi.mock('./prisma.js', () => ({ prisma: { tripInvite: { findUnique } } }));

const { isValidTripInvite, shareTripUrl } = await import('./tripInvites.js');

describe('trip invites', () => {
    it('accepts only the current code for that trip', async () => {
        findUnique.mockResolvedValue({ tripId: 't1', code: 'ABCDEFGH23' });
        expect(await isValidTripInvite('t1', 'ABCDEFGH23')).toBe(true);
        expect(await isValidTripInvite('t1', 'WRONGCODE2')).toBe(false);
        expect(await isValidTripInvite('t1', '')).toBe(false);

        findUnique.mockResolvedValue(null);
        expect(await isValidTripInvite('t1', 'ABCDEFGH23')).toBe(false);
    });

    it('builds share links on the API origin', () => {
        process.env.API_PUBLIC_URL = 'https://api.pickandsync.com/';
        expect(shareTripUrl({}, 't1')).toBe('https://api.pickandsync.com/share/trips/t1');
        expect(shareTripUrl({}, 't1', 'ABC')).toBe('https://api.pickandsync.com/share/trips/t1?invite=ABC');
        delete process.env.API_PUBLIC_URL;
    });
});
