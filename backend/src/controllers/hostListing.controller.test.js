import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import 'express-async-errors';
import request from 'supertest';
import { prisma } from '../utils/prisma.js';
import { assertFullyVerified, assertPolicyAccepted, assertVehicleVerified } from '../utils/verificationHelpers.js';
import { getHostListings, listingChanges, updateHostListing } from './hostListing.controller.js';

vi.mock('../utils/prisma.js', () => ({ prisma: {
    $transaction: vi.fn(), $executeRaw: vi.fn(),
    rentalListing: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    rentalBooking: { findFirst: vi.fn() },
} }));
vi.mock('../utils/verificationHelpers.js', () => ({ assertFullyVerified: vi.fn(), assertPolicyAccepted: vi.fn(), assertVehicleVerified: vi.fn() }));
const listing = { id: 'listing', hostId: 'host', vehicleId: 'car', vehicle: { isVerified: true, type: 'CAR' }, availableFrom: new Date('2030-01-01'), availableTo: new Date('2030-12-31'), pricePerDay: 2000, isActive: true };
const res = () => ({ json: vi.fn() });

beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.rentalListing.findUnique.mockResolvedValue(listing);
    prisma.rentalBooking.findFirst.mockResolvedValue(null);
    prisma.rentalListing.update.mockResolvedValue(listing);
});
describe('host listing management', () => {
    it('always scopes private listing queries to the authenticated host', async () => {
        await getHostListings({ user: { id: 'host' }, query: { hostId: 'victim' } }, res());
        expect(prisma.rentalListing.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { hostId: 'host' } }));
    });
    it('rejects a listing from another host without revealing it', async () => {
        await expect(updateHostListing({ user: { id: 'attacker' }, params: { id: 'listing' }, body: { isActive: false } }, res())).rejects.toMatchObject({ statusCode: 404 });
        expect(prisma.rentalListing.update).not.toHaveBeenCalled();
    });
    it.each([{ hostId: 'attacker' }, { vehicleId: 'other' }, { country: 'AE' }, { currency: 'USD' }, { bookings: { deleteMany: {} } }])('blocks mass assignment: %j', (body) => {
        expect(() => listingChanges(body, listing)).toThrow();
    });
    it.each([{ pricePerDay: 'NaN' }, { pricePerDay: 'Infinity' }, { pricePerDay: -1 }, { pricePerDay: 0.001 }, { isActive: 'false' }, { availableFrom: '2030-02-30' }, { availableTo: 'invalid' }, { availableTo: '2029-12-30' }])('rejects invalid values: %j', (body) => {
        expect(() => listingChanges(body, listing)).toThrow();
    });
    it('allows pausing without cancelling or repricing reservations', async () => {
        await updateHostListing({ user: { id: 'host' }, params: { id: 'listing' }, body: { isActive: false } }, res());
        expect(prisma.rentalListing.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
        expect(assertFullyVerified).not.toHaveBeenCalled();
        expect(prisma.rentalBooking.findFirst).not.toHaveBeenCalled();
    });
    it('requires identity, terms and RC checks to republish', async () => {
        await updateHostListing({ user: { id: 'host' }, params: { id: 'listing' }, body: { isActive: true } }, res());
        expect(assertFullyVerified).toHaveBeenCalledWith('host');
        expect(assertPolicyAccepted).toHaveBeenCalledWith('host', 'LISTING_TERMS');
        expect(assertVehicleVerified).toHaveBeenCalledWith(listing.vehicle);
    });
    it('preserves pending, accepted and paid reservations when editing dates', async () => {
        prisma.rentalBooking.findFirst.mockResolvedValue({ id: 'existing-reservation' });
        await expect(updateHostListing({ user: { id: 'host' }, params: { id: 'listing' }, body: { availableTo: '2030-03-01' } }, res())).rejects.toMatchObject({ statusCode: 409 });
        const where = prisma.rentalBooking.findFirst.mock.calls[0][0].where;
        expect(where.status.in).toEqual(['PENDING', 'CONFIRMED', 'PAID']);
        expect(prisma.rentalListing.update).not.toHaveBeenCalled();
    });
    it('parameterizes SQL-like location text as ordinary listing data', async () => {
        const location = "Bengaluru'; DROP TABLE users; --";
        await updateHostListing({ user: { id: 'host' }, params: { id: 'listing' }, body: { location, pricePerDay: '1900.12' } }, res());
        expect(prisma.rentalListing.update).toHaveBeenCalledWith(expect.objectContaining({ data: { location, pricePerDay: 1900.12 } }));
        expect(prisma.$executeRaw).toHaveBeenCalledOnce();
    });
});

describe('private listing HTTP contract', () => {
    const app = express();
    app.use(express.json());
    // Authentication fixture: the ownership policy remains the production controller.
    const auth = (req, res, next) => { if (!req.get('x-test-user')) return res.status(401).json({ success: false }); req.user = { id: req.get('x-test-user') }; next(); };
    app.get('/listings/host', auth, getHostListings);
    app.patch('/listings/:id', auth, updateHostListing);
    app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ success: false, message: err.message }));
    it('requires authentication to fetch fleet listings', async () => {
        await request(app).get('/listings/host').expect(401);
        expect(prisma.rentalListing.findMany).not.toHaveBeenCalled();
    });
    it('returns a real conflict response when new dates exclude a reservation', async () => {
        prisma.rentalBooking.findFirst.mockResolvedValue({ id: 'reservation' });
        await request(app).patch('/listings/listing').set('x-test-user', 'host').send({ availableTo: '2030-03-01' }).expect(409);
    });
});
