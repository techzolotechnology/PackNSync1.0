import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import {
    assertFullyVerified,
    assertPolicyAccepted,
    assertVehicleVerified,
} from '../utils/verificationHelpers.js';
import {
    sendBookingConfirmationEmail,
    rentalBookingEmailHtml,
} from '../utils/bookingEmail.js';

// POST /api/rentals/listings
export const createListing = async (req, res) => {
    await assertFullyVerified(req.user.id);
    await assertPolicyAccepted(req.user.id, 'LISTING_TERMS');

    const { vehicleId, pricePerDay, location, description, availableFrom, availableTo } = req.body;
    const start = new Date(availableFrom);
    const end = new Date(availableTo);

    if (!vehicleId || !pricePerDay || !location || !availableFrom || !availableTo) {
        throw new AppError('Vehicle, price, location, and availability dates are required.', 400);
    }
    if (Number(pricePerDay) <= 0) throw new AppError('Price per day must be greater than zero.', 400);
    if (end <= start) throw new AppError('Available to date must be after available from date.', 400);

    // Verify vehicle ownership
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new AppError('Vehicle not found.', 404);
    if (vehicle.ownerId !== req.user.id) throw new AppError('Only the vehicle owner can create a listing.', 403);
    await assertVehicleVerified(vehicle);

    const listing = await prisma.rentalListing.create({
        data: {
            vehicleId,
            hostId: req.user.id,
            pricePerDay: Number(pricePerDay),
            location,
            description,
            availableFrom: start,
            availableTo: end,
        },
        include: { vehicle: true },
    });

    res.status(201).json({ success: true, data: listing });
};

// GET /api/rentals/listings
export const getListings = async (req, res) => {
    const { location, minPrice, maxPrice, type, startDate, endDate } = req.query;

    const where = { isActive: true };
    if (location) where.location = { contains: location, mode: 'insensitive' };
    if (minPrice || maxPrice) {
        where.pricePerDay = {};
        if (minPrice) where.pricePerDay.gte = Number(minPrice);
        if (maxPrice) where.pricePerDay.lte = Number(maxPrice);
    }
    if (type) {
        where.vehicle = { type: type.toUpperCase() };
    }
    if (startDate) {
        where.availableFrom = { lte: new Date(startDate) };
    }
    if (endDate) {
        where.availableTo = { gte: new Date(endDate) };
    }

    const listings = await prisma.rentalListing.findMany({
        where,
        include: {
            vehicle: true,
            host: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { pricePerDay: 'asc' },
    });

    res.json({ success: true, data: listings });
};

// GET /api/rentals/listings/:id
export const getListingById = async (req, res) => {
    const listing = await prisma.rentalListing.findUnique({
        where: { id: req.params.id },
        include: {
            vehicle: true,
            host: { select: { id: true, name: true, avatarUrl: true, bio: true } },
        },
    });
    if (!listing) throw new AppError('Listing not found.', 404);
    res.json({ success: true, data: listing });
};

// POST /api/rentals/bookings
export const bookRental = async (req, res) => {
    await assertFullyVerified(req.user.id);
    await assertPolicyAccepted(req.user.id, 'RENTAL_TERMS');

    const { listingId, startDate, endDate } = req.body;

    const listing = await prisma.rentalListing.findUnique({
        where: { id: listingId },
        include: { vehicle: true },
    });
    if (!listing) throw new AppError('Listing not found.', 404);
    if (!listing.isActive) throw new AppError('Listing is no longer active.', 400);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (days <= 0) throw new AppError('End date must be after start date.', 400);
    if (start < listing.availableFrom || end > listing.availableTo) {
        throw new AppError('Selected dates are outside this vehicle availability window.', 400);
    }
    if (listing.hostId === req.user.id) {
        throw new AppError('You cannot book your own vehicle listing.', 400);
    }

    const overlappingBooking = await prisma.rentalBooking.findFirst({
        where: {
            listingId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            startDate: { lt: end },
            endDate: { gt: start },
        },
    });
    if (overlappingBooking) throw new AppError('This vehicle already has a booking request for the selected dates.', 409);

    const totalPrice = listing.pricePerDay * days;

    const booking = await prisma.rentalBooking.create({
        data: {
            listingId,
            renterId: req.user.id,
            startDate: start,
            endDate: end,
            totalPrice,
            status: 'PENDING',
        },
    });

    // Notify host
    const io = req.app.get('io');
    io?.to(`user:${listing.hostId}`).emit('rental_booking_received', {
        bookingId: booking.id,
        listingTitle: `${listing.vehicle.make} ${listing.vehicle.model}`,
        renterName: req.user.name,
    });

    const vehicleLabel = `${listing.vehicle.make} ${listing.vehicle.model}`;
    const dateFmt = (d) => new Date(d).toLocaleDateString('en-IN');
    const emailFields = {
        vehicleLabel,
        location: listing.location,
        startDate: dateFmt(start),
        endDate: dateFmt(end),
        totalPrice,
    };

    try {
        const [renter, host] = await Promise.all([
            prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true, name: true } }),
            prisma.user.findUnique({ where: { id: listing.hostId }, select: { email: true, name: true } }),
        ]);

        await Promise.all([
            sendBookingConfirmationEmail({
                to: renter?.email,
                subject: `Rental request sent — ${vehicleLabel}`,
                html: rentalBookingEmailHtml({
                    ...emailFields,
                    renterName: renter?.name || req.user.name,
                    hostName: host?.name || 'Host',
                    isHost: false,
                }),
            }),
            sendBookingConfirmationEmail({
                to: host?.email,
                subject: `New rental request — ${vehicleLabel}`,
                html: rentalBookingEmailHtml({
                    ...emailFields,
                    renterName: renter?.name || req.user.name,
                    hostName: host?.name || 'Host',
                    isHost: true,
                }),
            }),
        ]);
    } catch (err) {
        console.error('[Rental booking email]', err.message);
    }

    res.status(201).json({ success: true, data: booking });
};

// GET /api/rentals/bookings/my
export const getMyBookings = async (req, res) => {
    const bookings = await prisma.rentalBooking.findMany({
        where: { renterId: req.user.id },
        include: {
            listing: {
                include: { vehicle: true, host: { select: { name: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: bookings });
};

// GET /api/rentals/bookings/host
export const getHostBookings = async (req, res) => {
    const bookings = await prisma.rentalBooking.findMany({
        where: {
            listing: { hostId: req.user.id },
        },
        include: {
            renter: { select: { id: true, name: true, email: true, avatarUrl: true } },
            listing: {
                include: {
                    vehicle: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: bookings });
};
