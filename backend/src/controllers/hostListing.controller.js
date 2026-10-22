import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { assertFullyVerified, assertPolicyAccepted, assertVehicleVerified } from '../utils/verificationHelpers.js';
import { assertRoadVehicle } from '../utils/vehicleCategories.js';

// Private fleet data, including paused listings. Never accept a hostId from the client.
export const getHostListings = async (req, res) => {
    const listings = await prisma.rentalListing.findMany({
        where: { hostId: req.user.id },
        include: { vehicle: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: listings });
};

export function listingChanges(body, listing) {
    const allowed = ['pricePerDay', 'location', 'description', 'availableFrom', 'availableTo', 'isActive'];
    if (!body || !Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) {
        throw new AppError('Only price, location, description, availability and listing status can be changed.', 400);
    }
    const data = {};
    if (body.pricePerDay !== undefined) {
        if (!['string', 'number'].includes(typeof body.pricePerDay)) throw new AppError('Enter a valid daily price.', 400);
        const price = Number(body.pricePerDay);
        if (!Number.isFinite(price) || price <= 0 || price > 1000000) throw new AppError('Enter a daily price between 0.01 and 1,000,000.', 400);
        data.pricePerDay = Math.round(price * 100) / 100;
        if (!data.pricePerDay) throw new AppError('Daily price must be at least 0.01.', 400);
    }
    if (body.location !== undefined) {
        if (typeof body.location !== 'string' || !body.location.trim() || body.location.trim().length > 200) throw new AppError('Enter a pickup location up to 200 characters.', 400);
        data.location = body.location.trim();
    }
    if (body.description !== undefined) {
        if (typeof body.description !== 'string' || body.description.length > 3000) throw new AppError('Description must be text up to 3,000 characters.', 400);
        data.description = body.description.trim();
    }
    for (const field of ['availableFrom', 'availableTo']) {
        if (body[field] === undefined) continue;
        if (typeof body[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(body[field])) throw new AppError('Enter valid availability dates.', 400);
        const date = new Date(body[field]);
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== body[field].slice(0, 10)) throw new AppError('Enter valid availability dates.', 400);
        data[field] = date;
    }
    if (new Date(data.availableTo ?? listing.availableTo) <= new Date(data.availableFrom ?? listing.availableFrom)) throw new AppError('Availability must end after it starts.', 400);
    if (body.isActive !== undefined) {
        if (typeof body.isActive !== 'boolean') throw new AppError('Listing status must be true or false.', 400);
        data.isActive = body.isActive;
    }
    return data;
}

export const updateHostListing = async (req, res) => {
    const updated = await prisma.$transaction(async (tx) => {
        // Same lock as booking creation: a listing cannot change halfway through a booking.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.id}))`;
        const listing = await tx.rentalListing.findUnique({ where: { id: req.params.id }, include: { vehicle: true } });
        if (!listing || listing.hostId !== req.user.id) throw new AppError('Listing not found in your fleet.', 404);
        assertRoadVehicle(listing.vehicle);
        const data = listingChanges(req.body, listing);
        if (data.isActive === true) {
            await assertFullyVerified(req.user.id);
            await assertPolicyAccepted(req.user.id, 'LISTING_TERMS');
            await assertVehicleVerified(listing.vehicle);
            if (new Date(data.availableTo ?? listing.availableTo) <= new Date()) throw new AppError('Extend availability before publishing this listing.', 400);
        }
        if (data.availableFrom || data.availableTo) {
            const fromDay = new Date(data.availableFrom ?? listing.availableFrom);
            const toDay = new Date(data.availableTo ?? listing.availableTo);
            fromDay.setUTCHours(0, 0, 0, 0);
            toDay.setUTCHours(23, 59, 59, 999);
            const outside = await tx.rentalBooking.findFirst({ where: {
                listingId: listing.id,
                status: { in: ['PENDING', 'CONFIRMED', 'PAID'] },
                endDate: { gt: new Date() },
                OR: [
                    { startDate: { lt: fromDay } },
                    { endDate: { gt: toDay } },
                ],
            } });
            if (outside) throw new AppError('These dates exclude an existing reservation. Keep its dates within your availability.', 409);
        }
        // Booking totals are snapshots; editing a listing never reprices existing reservations.
        return tx.rentalListing.update({ where: { id: listing.id }, data, include: { vehicle: true } });
    });
    res.json({ success: true, data: updated });
};
