import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../utils/prisma.js';
import { bookRental, cancelBooking, getMyEarnings, respondToBooking } from './rental.controller.js';
vi.mock('../utils/prisma.js', () => ({ prisma: {
    $transaction: vi.fn(), $executeRaw: vi.fn(),
    rentalBooking: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    rentalListing: { findUnique: vi.fn() },
    hostEarning: { findMany: vi.fn(), groupBy: vi.fn() },
} }));
vi.mock('../utils/verificationHelpers.js', () => ({ assertFullyVerified: vi.fn(), assertPolicyAccepted: vi.fn(), assertVehicleVerified: vi.fn() }));
vi.mock('../utils/notify.js', () => ({ notifyUser: vi.fn() }));
vi.mock('../utils/bookingEmail.js', () => ({ sendRentalBookingRequestMail: vi.fn(), sendRentalBookingDecisionMail: vi.fn() }));
const listing = { id: 'listing', hostId: 'host', vehicle: { make: 'Hyundai', model: 'i20', type: 'CAR' }, pricePerDay: 2000, isActive: true, availableFrom: new Date('2030-01-01'), availableTo: new Date('2030-12-31') };
beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.rentalListing.findUnique.mockResolvedValue(listing);
});
describe('host booking concurrency', () => {
    it('rejects a price change while a new guest booking waited for the listing lock', async () => {
        prisma.rentalListing.findUnique.mockResolvedValueOnce(listing).mockResolvedValueOnce({ ...listing, pricePerDay: 2400 });
        await expect(bookRental({ user: { id: 'guest' }, body: { listingId: 'listing', startDate: '2030-02-01', endDate: '2030-02-03' } }, {})).rejects.toMatchObject({ statusCode: 409 });
        expect(prisma.rentalBooking.create).not.toHaveBeenCalled();
    });
    it('rejects a listing paused while a guest request waited for the lock', async () => {
        prisma.rentalListing.findUnique.mockResolvedValueOnce(listing).mockResolvedValueOnce({ ...listing, isActive: false });
        await expect(bookRental({ user: { id: 'guest' }, body: { listingId: 'listing', startDate: '2030-02-01', endDate: '2030-02-03' } }, {})).rejects.toMatchObject({ statusCode: 409 });
        expect(prisma.rentalBooking.create).not.toHaveBeenCalled();
    });
    it('does not resurrect a booking cancelled while the host was deciding', async () => {
        prisma.rentalBooking.findUnique.mockResolvedValue({ id: 'booking', status: 'PENDING', listing });
        prisma.rentalBooking.updateMany.mockResolvedValue({ count: 0 });
        await expect(respondToBooking({ user: { id: 'host' }, params: { id: 'booking' }, body: { status: 'CONFIRMED' } }, {})).rejects.toMatchObject({ statusCode: 409 });
        expect(prisma.rentalBooking.updateMany).toHaveBeenCalledWith({ where: { id: 'booking', status: 'PENDING' }, data: { status: 'CONFIRMED' } });
    });
    it('does not let a guest approve another host’s reservation', async () => {
        prisma.rentalBooking.findUnique.mockResolvedValue({ id: 'booking', status: 'PENDING', listing });
        await expect(respondToBooking({ user: { id: 'guest' }, params: { id: 'booking' }, body: { status: 'CONFIRMED' } }, {})).rejects.toMatchObject({ statusCode: 403 });
        expect(prisma.rentalBooking.updateMany).not.toHaveBeenCalled();
    });
    it('does not cancel a reservation paid after the cancellation request first read it', async () => {
        prisma.rentalBooking.findUnique.mockResolvedValue({ id: 'booking', renterId: 'guest', status: 'CONFIRMED', listing });
        prisma.rentalBooking.updateMany.mockResolvedValue({ count: 0 });
        await expect(cancelBooking({ user: { id: 'guest' }, params: { id: 'booking' } }, {})).rejects.toMatchObject({ statusCode: 409 });
        expect(prisma.rentalBooking.updateMany).toHaveBeenCalledWith({ where: { id: 'booking', status: { in: ['PENDING', 'CONFIRMED'] } }, data: { status: 'CANCELLED' } });
    });
    it('calculates totals beyond the 50 recent records shown in the app', async () => {
        prisma.hostEarning.findMany.mockResolvedValue([{ amount: 100, status: 'RELEASED' }]);
        prisma.hostEarning.groupBy.mockResolvedValue([{ status: 'RELEASED', _sum: { amount: 6000 } }, { status: 'PENDING', _sum: { amount: 2000 } }, { status: 'ON_HOLD', _sum: { amount: 300 } }]);
        const res = { json: vi.fn() };
        await getMyEarnings({ user: { id: 'host' } }, res);
        expect(res.json.mock.calls[0][0].data).toMatchObject({ released: 6000, upcoming: 2000, onHold: 300 });
        expect(prisma.hostEarning.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { hostId: 'host' } }));
    });
});
