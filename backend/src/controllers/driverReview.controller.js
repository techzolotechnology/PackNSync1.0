import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { notifyUser } from '../utils/notify.js';

const REVIEWABLE = new Set(['PAID', 'COMPLETED']);

function averageRating(reviews) {
    if (!reviews?.length) return null;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
}

// POST /api/rentals/bookings/:id/driver-review
export const createDriverReview = async (req, res) => {
    const { rating, comment } = req.body;
    const stars = Number(rating);

    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        throw new AppError('Rating must be an integer from 1 to 5.', 400);
    }

    const booking = await prisma.rentalBooking.findUnique({
        where: { id: req.params.id },
        include: {
            listing: { include: { vehicle: true, host: { select: { id: true, name: true } } } },
            driverReview: true,
        },
    });

    if (!booking) throw new AppError('Booking not found.', 404);
    if (booking.renterId !== req.user.id) {
        throw new AppError('Only the renter can review the driver for this booking.', 403);
    }
    if (!REVIEWABLE.has(booking.status)) {
        throw new AppError('Review the driver after the booking is paid.', 400);
    }
    if (booking.driverReview) {
        throw new AppError('You already reviewed this booking.', 409);
    }

    const driverId = booking.listing.hostId;
    if (driverId === req.user.id) {
        throw new AppError('You cannot review yourself.', 400);
    }

    const review = await prisma.driverReview.create({
        data: {
            reviewerId: req.user.id,
            driverId,
            rentalBookingId: booking.id,
            rating: stars,
            comment: typeof comment === 'string' ? comment.trim().slice(0, 500) || null : null,
        },
        include: {
            driver: { select: { id: true, name: true, avatarUrl: true } },
            reviewer: { select: { id: true, name: true } },
        },
    });

    const label = `${booking.listing.vehicle.make} ${booking.listing.vehicle.model}`;
    await notifyUser({
        userId: driverId,
        type: 'SYSTEM',
        title: 'New driver review',
        body: `${req.user.name} rated you ${stars}/5 for ${label}.`,
        data: { bookingId: booking.id, reviewId: review.id },
    });

    res.status(201).json({ success: true, data: review });
};

// GET /api/rentals/drivers/:userId/reviews
export const getDriverReviews = async (req, res) => {
    const reviews = await prisma.driverReview.findMany({
        where: { driverId: req.params.userId },
        include: {
            reviewer: { select: { id: true, name: true, avatarUrl: true } },
            rentalBooking: {
                select: {
                    id: true,
                    listing: {
                        select: {
                            vehicle: { select: { make: true, model: true } },
                        },
                    },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    res.json({
        success: true,
        data: reviews,
        meta: {
            count: reviews.length,
            averageRating: averageRating(reviews),
        },
    });
};

export { averageRating };
