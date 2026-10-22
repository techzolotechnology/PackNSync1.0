import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../utils/prisma.js';
import { publishAircraft, updateAircraft, reviewAircraft, createCharterInquiry, respondToCharterInquiry, cancelCharterInquiry, listPublicAircraft, requireAircraftOwner } from './aviation.controller.js';
import { AIRCRAFT_DOCUMENTS } from '../utils/aviation.js';

vi.mock('../utils/prisma.js', () => ({ prisma: {
    $transaction: vi.fn(), $executeRaw: vi.fn(),
    aircraftHosting: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    charterInquiry: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    vehicle: { findUnique: vi.fn() },
} }));
vi.mock('../utils/verificationHelpers.js', () => ({ assertFullyVerified: vi.fn() }));
vi.mock('../utils/notify.js', () => ({ notifyUser: vi.fn() }));
vi.mock('../utils/audit.js', () => ({ logAdminAction: vi.fn() }));
const docs = Object.fromEntries(Object.keys(AIRCRAFT_DOCUMENTS).map((key) => [key, { url: '/private.jpg', expiresAt: '2099-12-31' }]));
const aircraft = { id: 'aircraft', vehicleId: 'heli', status: 'APPROVED', isPublished: true, documents: docs, vehicle: { id: 'heli', type: 'HELICOPTER', seats: 4, ownerId: 'host', owner: { id: 'host', isBanned: false }, images: [] } };
const req = (body = {}, user = 'host') => ({ user: { id: user, name: 'Test host' }, params: { vehicleId: 'heli', id: 'aircraft' }, body });
const res = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis() });
beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((action) => action(prisma));
    prisma.aircraftHosting.findUnique.mockResolvedValue(aircraft);
    prisma.aircraftHosting.update.mockResolvedValue(aircraft);
    prisma.charterInquiry.updateMany.mockResolvedValue({ count: 1 });
});
describe('aircraft ownership and publication', () => {
    it('does not let another host publish this aircraft', async () => {
        await expect(publishAircraft(req({ isPublished: true }, 'intruder'), res())).rejects.toMatchObject({ statusCode: 404 });
        expect(prisma.aircraftHosting.update).not.toHaveBeenCalled();
    });
    it('cannot publish without operator review', async () => {
        prisma.aircraftHosting.findUnique.mockResolvedValue({ ...aircraft, status: 'PENDING' });
        await expect(publishAircraft(req({ isPublished: true }), res())).rejects.toMatchObject({ statusCode: 403 });
    });
    it('cannot publish with expired insurance even after earlier approval', async () => {
        prisma.aircraftHosting.findUnique.mockResolvedValue({ ...aircraft, documents: { ...docs, insurance: { url: '/private.jpg', expiresAt: '2000-01-01' } } });
        await expect(publishAircraft(req({ isPublished: true }), res())).rejects.toMatchObject({ statusCode: 403 });
    });
    it('operator detail edits reset review and publication instead of retaining approval', async () => {
        await updateAircraft(req({ operatorName: 'New operator', operatorPermitNumber: 'New reference', baseAirport: 'Test base', pricePerHour: 60000, status: 'APPROVED' }), res());
        expect(prisma.aircraftHosting.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT', isPublished: false, reviewedBy: null }) }));
    });
    it('does not accept generic RC uploads for helicopters or other accounts', async () => {
        prisma.vehicle.findUnique.mockResolvedValue(aircraft.vehicle);
        await expect(requireAircraftOwner(req({}, 'intruder'), {}, vi.fn())).rejects.toMatchObject({ statusCode: 404 });
    });
    it('does not publish rejected or expired profiles in the public directory', async () => {
        prisma.aircraftHosting.findMany.mockResolvedValue([aircraft, { ...aircraft, id: 'expired', documents: {} }, { ...aircraft, id: 'draft', status: 'DRAFT' }]);
        const response = res(); await listPublicAircraft({}, response);
        expect(response.json.mock.calls[0][0].data.map((a) => a.id)).toEqual(['aircraft']);
    });
    it('cannot approve a draft or bypass evidence submission', async () => {
        prisma.aircraftHosting.findUnique.mockResolvedValue({ ...aircraft, status: 'DRAFT' });
        await expect(reviewAircraft(req({ status: 'APPROVED', note: 'Checked operator evidence.' }, 'admin'), res())).rejects.toMatchObject({ statusCode: 409 });
    });
});
describe('helicopter quote requests', () => {
    it('checks passenger capacity before creating an enquiry', async () => {
        await expect(createCharterInquiry(req({ requestedDate: '2099-01-01', origin: 'A', destination: 'B', passengers: 5 }, 'guest'), res())).rejects.toMatchObject({ statusCode: 400 });
        expect(prisma.charterInquiry.create).not.toHaveBeenCalled();
    });
    it('does not let an owner enquire about their own helicopter', async () => {
        await expect(createCharterInquiry(req({}, 'host'), res())).rejects.toMatchObject({ statusCode: 400 });
    });
    it('does not accept enquiries for a banned operator', async () => {
        prisma.aircraftHosting.findUnique.mockResolvedValue({ ...aircraft, vehicle: { ...aircraft.vehicle, owner: { isBanned: true } } });
        await expect(createCharterInquiry(req({}, 'guest'), res())).rejects.toMatchObject({ statusCode: 404 });
    });
    it('scopes enquiry cancellation to its requester and an open status', async () => {
        await cancelCharterInquiry(req({}, 'guest'), res());
        expect(prisma.charterInquiry.updateMany).toHaveBeenCalledWith({ where: { id: 'aircraft', requesterId: 'guest', status: { in: ['NEW', 'QUOTED'] } }, data: { status: 'CANCELLED' } });
    });
    it('prevents another host from quoting', async () => {
        prisma.charterInquiry.findUnique.mockResolvedValue({ id: 'inq', aircraft, requesterId: 'guest', requestedDate: new Date('2099-01-01') });
        await expect(respondToCharterInquiry(req({ status: 'QUOTED', quotedAmount: 70000, quoteNote: 'Contact the operator to confirm.' }, 'intruder'), res())).rejects.toMatchObject({ statusCode: 404 });
    });
    it('does not overwrite a cancelled enquiry with a quote', async () => {
        prisma.charterInquiry.findUnique.mockResolvedValue({ id: 'inq', aircraft, requesterId: 'guest', requestedDate: new Date('2099-01-01') });
        prisma.charterInquiry.updateMany.mockResolvedValue({ count: 0 });
        await expect(respondToCharterInquiry(req({ status: 'QUOTED', quotedAmount: 70000, quoteNote: 'Contact the operator to confirm.' }), res())).rejects.toMatchObject({ statusCode: 409 });
    });
    it('checks a revoked operator review again under the aircraft lock', async () => {
        prisma.charterInquiry.findUnique.mockResolvedValue({ id: 'inq', aircraft, requesterId: 'guest', requestedDate: new Date('2099-01-01') });
        prisma.aircraftHosting.findUnique.mockResolvedValue({ ...aircraft, status: 'REJECTED' });
        await expect(respondToCharterInquiry(req({ status: 'QUOTED', quotedAmount: 70000, quoteNote: 'Contact the operator to confirm.' }), res())).rejects.toMatchObject({ statusCode: 400 });
        expect(prisma.charterInquiry.updateMany).not.toHaveBeenCalled();
    });
});
