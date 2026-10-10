import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const tripFindUnique = vi.fn();
const inviteFindUnique = vi.fn();
vi.mock('../utils/prisma.js', () => ({
    prisma: { trip: { findUnique: tripFindUnique }, tripInvite: { findUnique: inviteFindUnique } },
}));

const { shareRouter } = await import('./share.routes.js');
const app = express().use('/share', shareRouter);

const PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const WHATSAPP = 'WhatsApp/2.23.20.0 A';

describe('GET /share/trips/:id', () => {
    beforeEach(() => {
        tripFindUnique.mockReset();
        inviteFindUnique.mockReset();
        process.env.FRONTEND_URL = 'https://pickandsync.com';
    });

    it('redirects people straight to the trip page without touching the database', async () => {
        const res = await request(app).get('/share/trips/t1?invite=ABC23').set('User-Agent', PHONE);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('https://pickandsync.com/trips/t1?invite=ABC23');
        expect(tripFindUnique).not.toHaveBeenCalled();
    });

    it('serves the trip preview to WhatsApp', async () => {
        tripFindUnique.mockResolvedValue({
            id: 't1', title: 'Coorg weekend', destination: 'Coorg', description: '', coverImageUrl: null,
            startDate: new Date('2026-11-07'), endDate: new Date('2026-11-09'), isPublic: true,
            organizer: { name: 'Kartik Gauttam' },
        });
        const res = await request(app).get('/share/trips/t1').set('User-Agent', WHATSAPP);
        expect(res.status).toBe(200);
        expect(res.text).toContain('<meta property="og:title" content="Coorg weekend – group trip to Coorg" />');
        expect(res.text).toContain('url=https://pickandsync.com/trips/t1');
    });

    it('keeps private trips private in the preview without a valid invite', async () => {
        tripFindUnique.mockResolvedValue({
            id: 't2', title: 'Secret plan', destination: 'Goa', description: '', coverImageUrl: null,
            startDate: new Date('2026-11-07'), endDate: new Date('2026-11-09'), isPublic: false,
            organizer: { name: 'Kartik' },
        });
        inviteFindUnique.mockResolvedValue({ tripId: 't2', code: 'RIGHTCODE2' });
        const res = await request(app).get('/share/trips/t2?invite=WRONGCODE2').set('User-Agent', WHATSAPP);
        expect(res.text).toContain('Join a trip on PickAndSync');
        expect(res.text).not.toContain('Secret plan');
    });
});
