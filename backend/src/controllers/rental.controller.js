import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import {
    assertFullyVerified,
    assertPolicyAccepted,
    assertVehicleVerified,
} from '../utils/verificationHelpers.js';
import {
    sendRentalBookingRequestMail,
    sendRentalBookingDecisionMail,
} from '../utils/bookingEmail.js';
import { notifyUser } from '../utils/notify.js';
import { findSuggestedCars } from '../utils/carSuggestions.js';
import { averageRating } from './driverReview.controller.js';

// GET /api/rentals/suggestions — cars matched to trip dates / destination / seats
export const getCarSuggestions = async (req, res) => {
    const { destination, startDate, endDate, seats, limit } = req.query;
    const result = await findSuggestedCars(prisma, {
        destination,
        startDate,
        endDate,
        seats,
        limit,
        excludeHostId: req.user?.id || null,
    });
    res.json({ success: true, data: result.suggestions, meta: result.meta });
};

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

/** Date-only strings (YYYY-MM-DD) from the UI are midnight UTC; listing
 *  windows are often noon. Compare whole calendar days so "available today"
 *  is not filtered out of a same-day search. */
const startOfUtcDay = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};
const endOfUtcDay = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
};

// GET /api/rentals/listings
export const getListings = async (req, res) => {
    const { location, minPrice, maxPrice, type, kind, startDate, endDate } = req.query;

    const where = { isActive: true };
    if (location) where.location = { contains: location, mode: 'insensitive' };
    if (minPrice || maxPrice) {
        where.pricePerDay = {};
        if (minPrice) where.pricePerDay.gte = Number(minPrice);
        if (maxPrice) where.pricePerDay.lte = Number(maxPrice);
    }

    const kindNorm = String(kind || '').trim().toLowerCase();
    const typeNorm = String(type || '').trim().toUpperCase();
    if (kindNorm === 'bike' || kindNorm === 'bikes' || typeNorm === 'TWO_WHEELER') {
        where.vehicle = { ...(where.vehicle || {}), type: { in: ['BIKE', 'SCOOTER'] } };
    } else if (kindNorm === 'car' || kindNorm === 'cars') {
        where.vehicle = { ...(where.vehicle || {}), type: 'CAR' };
    } else if (typeNorm) {
        if (typeNorm.includes(',')) {
            const types = typeNorm.split(',').map((t) => t.trim()).filter(Boolean);
            where.vehicle = { ...(where.vehicle || {}), type: { in: types } };
        } else {
            where.vehicle = { ...(where.vehicle || {}), type: typeNorm };
        }
    }

    if (startDate) {
        const end = endOfUtcDay(startDate);
        if (end) where.availableFrom = { lte: end };
    }
    if (endDate) {
        const start = startOfUtcDay(endDate);
        if (start) where.availableTo = { gte: start };
    }

    const listings = await prisma.rentalListing.findMany({
        where,
        include: {
            vehicle: true,
            host: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { pricePerDay: 'asc' },
    });

    const hostIds = [...new Set(listings.map((l) => l.hostId))];
    const reviews = hostIds.length
        ? await prisma.driverReview.findMany({
            where: { driverId: { in: hostIds } },
            select: { driverId: true, rating: true },
        })
        : [];

    const byHost = new Map();
    for (const r of reviews) {
        if (!byHost.has(r.driverId)) byHost.set(r.driverId, []);
        byHost.get(r.driverId).push(r);
    }

    const data = listings.map((listing) => {
        const hostReviews = byHost.get(listing.hostId) || [];
        return {
            ...listing,
            host: {
                ...listing.host,
                averageRating: averageRating(hostReviews),
                reviewCount: hostReviews.length,
            },
        };
    });

    res.json({ success: true, data });
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
    // Compare calendar days so a listing available "today at noon" still books for today.
    if (
        startOfUtcDay(listing.availableFrom) > startOfUtcDay(start)
        || startOfUtcDay(listing.availableTo) < startOfUtcDay(end)
    ) {
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
            sendRentalBookingRequestMail({
                to: renter?.email,
                subject: `Rental request sent — ${vehicleLabel}`,
                ...emailFields,
                renterName: renter?.name || req.user.name,
                hostName: host?.name || 'Host',
                isHost: false,
            }),
            sendRentalBookingRequestMail({
                to: host?.email,
                subject: `New rental request — ${vehicleLabel}`,
                ...emailFields,
                renterName: renter?.name || req.user.name,
                hostName: host?.name || 'Host',
                isHost: true,
            }),
        ]);
    } catch (err) {
        console.error('[Rental booking email]', err.message);
    }

    await notifyUser({
        userId: listing.hostId,
        type: 'SYSTEM',
        title: 'New rental booking request',
        body: `${req.user.name} requested ${vehicleLabel} (${dateFmt(start)} – ${dateFmt(end)}).`,
        data: { bookingId: booking.id, listingId: listing.id },
    });
    await notifyUser({
        userId: req.user.id,
        type: 'SYSTEM',
        title: 'Booking request sent',
        body: `Your request for ${vehicleLabel} is pending host confirmation.`,
        data: { bookingId: booking.id },
    });

    res.status(201).json({ success: true, data: booking });
};

// PATCH /api/rentals/bookings/:id/cancel — renter cancels
export const cancelBooking = async (req, res) => {
    const booking = await prisma.rentalBooking.findUnique({
        where: { id: req.params.id },
        include: {
            listing: { include: { vehicle: true, host: { select: { id: true, name: true } } } },
        },
    });
    if (!booking) throw new AppError('Booking not found.', 404);
    if (booking.renterId !== req.user.id) throw new AppError('Only the renter can cancel this booking.', 403);
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
        throw new AppError(`Cannot cancel a booking with status ${booking.status}.`, 400);
    }

    const updated = await prisma.rentalBooking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
        include: {
            listing: { include: { vehicle: true, host: { select: { id: true, name: true } } } },
        },
    });

    const label = `${booking.listing.vehicle.make} ${booking.listing.vehicle.model}`;
    await notifyUser({
        userId: booking.listing.hostId,
        type: 'SYSTEM',
        title: 'Booking cancelled',
        body: `${req.user.name} cancelled their request for ${label}.`,
        data: { bookingId: booking.id },
    });
    await notifyUser({
        userId: req.user.id,
        type: 'SYSTEM',
        title: 'Booking cancelled',
        body: `You cancelled ${label}.`,
        data: { bookingId: booking.id },
    });

    res.json({ success: true, data: updated });
};

// PATCH /api/rentals/bookings/:id/respond — host confirm/reject
export const respondToBooking = async (req, res) => {
    const { status } = req.body; // CONFIRMED | REJECTED
    if (!['CONFIRMED', 'REJECTED'].includes(status)) {
        throw new AppError('Status must be CONFIRMED or REJECTED.', 400);
    }

    const booking = await prisma.rentalBooking.findUnique({
        where: { id: req.params.id },
        include: { listing: { include: { vehicle: true } } },
    });
    if (!booking) throw new AppError('Booking not found.', 404);
    if (booking.listing.hostId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('Only the host can respond to this booking.', 403);
    }
    if (booking.status !== 'PENDING') {
        throw new AppError('Only pending bookings can be confirmed or rejected.', 400);
    }

    const updated = await prisma.rentalBooking.update({
        where: { id: booking.id },
        data: { status },
        include: {
            listing: { include: { vehicle: true, host: { select: { id: true, name: true } } } },
            renter: { select: { id: true, name: true, email: true } },
        },
    });

    const label = `${booking.listing.vehicle.make} ${booking.listing.vehicle.model}`;
    const confirmed = status === 'CONFIRMED';
    const dateFmt = (d) => new Date(d).toLocaleDateString('en-IN');

    try {
        await sendRentalBookingDecisionMail({
            to: updated.renter?.email,
            subject: confirmed
                ? `Booking confirmed — ${label}`
                : `Booking declined — ${label}`,
            renterName: updated.renter?.name || 'there',
            vehicleLabel: label,
            location: booking.listing.location,
            startDate: dateFmt(booking.startDate),
            endDate: dateFmt(booking.endDate),
            totalPrice: booking.totalPrice,
            confirmed,
        });
    } catch (err) {
        console.error('[Rental decision email]', err.message);
    }

    await notifyUser({
        userId: booking.renterId,
        type: confirmed ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
        title: confirmed ? 'Booking confirmed' : 'Booking declined',
        body: confirmed
            ? `Host confirmed ${label}. You can pay now from My Bookings.`
            : `Host declined your request for ${label}.`,
        data: { bookingId: booking.id },
    });

    res.json({ success: true, data: updated });
};

// POST /api/rentals/bookings/:id/pay — traveler settles rental payment
// body.method: 'wallet' (default) | 'local' (dev card stub)
export const payBooking = async (req, res) => {
    const booking = await prisma.rentalBooking.findUnique({
        where: { id: req.params.id },
        include: { listing: { include: { vehicle: true } } },
    });
    if (!booking) throw new AppError('Booking not found.', 404);
    if (booking.renterId !== req.user.id) throw new AppError('Only the renter can pay for this booking.', 403);
    if (booking.status !== 'CONFIRMED') {
        throw new AppError('Pay after the host confirms your booking.', 400);
    }

    const amount = Number(booking.totalPrice);
    const method = String(req.body?.method || 'wallet').toLowerCase();
    const label = `${booking.listing.vehicle.make} ${booking.listing.vehicle.model}`;
    let paymentRef;

    if (method === 'wallet') {
        const { debitWallet } = await import('../utils/wallet.js');
        const spend = await debitWallet({
            userId: req.user.id,
            amount,
            type: 'SPEND',
            status: 'SUCCESS',
            referenceId: `rental_${booking.id}`,
            description: `Rental: ${label}`,
            provider: 'INTERNAL',
            metadata: { bookingId: booking.id },
        });
        paymentRef = `wallet_${spend.transaction.id}`;
        await prisma.payment.create({
            data: {
                userId: req.user.id,
                stripePaymentId: paymentRef,
                amount,
                currency: 'inr',
                status: 'succeeded',
            },
        });
    } else {
        paymentRef = `local_pay_${booking.id}_${Date.now()}`;
        await prisma.payment.create({
            data: {
                userId: req.user.id,
                stripePaymentId: paymentRef,
                amount,
                currency: 'inr',
                status: 'succeeded',
            },
        });
    }

    const updated = await prisma.rentalBooking.update({
        where: { id: booking.id },
        data: { status: 'PAID' },
        include: {
            listing: { include: { vehicle: true, host: { select: { id: true, name: true } } } },
        },
    });

    await notifyUser({
        userId: booking.listing.hostId,
        type: 'PAYMENT_RECEIVED',
        title: 'Rental payment received',
        body: `${req.user.name} paid ₹${amount.toLocaleString()} for ${label}${method === 'wallet' ? ' (wallet)' : ''}.`,
        data: { bookingId: booking.id },
    });
    await notifyUser({
        userId: req.user.id,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment successful',
        body: `You paid ₹${amount.toLocaleString()} for ${label}${method === 'wallet' ? ' from your wallet' : ''}.`,
        data: { bookingId: booking.id },
    });

    res.json({ success: true, data: updated, paid: true, method });
};

// GET /api/rentals/bookings/my
export const getMyBookings = async (req, res) => {
    const bookings = await prisma.rentalBooking.findMany({
        where: { renterId: req.user.id },
        include: {
            listing: {
                include: { vehicle: true, host: { select: { id: true, name: true } } },
            },
            driverReview: true,
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
