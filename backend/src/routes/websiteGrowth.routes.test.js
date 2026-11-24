import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { parseGrowthEvent } from '../../../shared/websiteGrowth.mjs';
import { prisma } from '../utils/prisma.js';
import { websiteGrowthRouter } from './websiteGrowth.routes.js';

vi.mock('../utils/prisma.js', () => ({ prisma: { $executeRaw: vi.fn() } }));

const app = express();
app.use('/growth', websiteGrowthRouter);
const search = { event: 'rental_search', source: 'Google', landing: 'Rentals', market: 'Gurugram', vehicle: 'car' };

describe('website growth ingestion', () => {
    it('rejects nonstandard dimensions and drops details from non-rental events', () => {
        expect(parseGrowthEvent({ ...search, market: 'My home address' })).toBeNull();
        expect(parseGrowthEvent({ ...search, event: ['rental_search'] })).toBeNull();
        expect(parseGrowthEvent({ ...search, event: 'trip_created', token: 'private' })).toEqual({
            event: 'trip_created', source: 'Google', landing: 'Rentals', market: '', vehicle: '',
        });
    });

    it('stores only the approved dimensions and honors browser privacy signals', async () => {
        prisma.$executeRaw.mockClear();
        await request(app).post('/growth').set('Sec-GPC', '1').send(search).expect(204);
        await request(app).post('/growth').send({ ...search, market: 'Unknown' }).expect(400);
        expect(prisma.$executeRaw).not.toHaveBeenCalled();

        await request(app).post('/growth').send({ ...search, email: 'ignored@example.com' }).expect(204);
        expect(prisma.$executeRaw).toHaveBeenCalledOnce();
        expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual(['rental_search', 'Google', 'Rentals', 'Gurugram', 'car']);
    });
});
