import { Router } from 'express';
import {
    createListing, getListings, getListingById, getCarSuggestions, bookRental, getMyBookings, getHostBookings,
    cancelBooking, respondToBooking, payBooking, quoteBooking, getMyEarnings,
} from '../controllers/rental.controller.js';
import {
    postCheckinInspection,
    postCheckoutInspection,
    getBookingInspection,
    postFileClaim,
    confirmInspection, disputeInspection, getInspectionImage, exportInspection, inspectionEnabled,
} from '../controllers/damageInspection.controller.js';
import { inspectionWriteLimiter } from '../middleware/inspectionLimiter.js';
import { requireAdminMfa } from '../middleware/adminMfa.middleware.js';
import { createDriverReview, getDriverReviews } from '../controllers/driverReview.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';

export const rentalRouter = Router();

rentalRouter.post('/listings', authenticate, createListing);
rentalRouter.get('/listings', getListings);
rentalRouter.get('/suggestions', optionalAuth, getCarSuggestions);
rentalRouter.get('/listings/:id', getListingById);
rentalRouter.post('/bookings', authenticate, bookRental);
rentalRouter.get('/bookings/my', authenticate, getMyBookings);
rentalRouter.get('/bookings/host', authenticate, getHostBookings);
rentalRouter.get('/earnings/my', authenticate, getMyEarnings);
rentalRouter.patch('/bookings/:id/cancel', authenticate, cancelBooking);
rentalRouter.patch('/bookings/:id/respond', authenticate, respondToBooking);
rentalRouter.get('/bookings/:id/quote', authenticate, quoteBooking);
rentalRouter.post('/bookings/:id/pay', authenticate, payBooking);
rentalRouter.post('/bookings/:id/driver-review', authenticate, createDriverReview);
rentalRouter.get('/drivers/:userId/reviews', getDriverReviews);

// Owned inspection evidence; admins must pass the same MFA gate as their panel.
const inspectionAccess = [authenticate, inspectionEnabled, (req, res, next) => req.user.role === 'ADMIN' ? requireAdminMfa(req, res, next) : next()];
rentalRouter.post('/bookings/:id/inspection/checkin', ...inspectionAccess, inspectionWriteLimiter, postCheckinInspection);
rentalRouter.post('/bookings/:id/inspection/checkout', ...inspectionAccess, inspectionWriteLimiter, postCheckoutInspection);
rentalRouter.get('/bookings/:id/inspection', ...inspectionAccess, getBookingInspection);
rentalRouter.get('/bookings/:id/inspection/images/:imageId', ...inspectionAccess, getInspectionImage);
rentalRouter.get('/bookings/:id/inspection/export', ...inspectionAccess, exportInspection);
rentalRouter.post('/bookings/:id/inspection/confirm', ...inspectionAccess, inspectionWriteLimiter, confirmInspection);
rentalRouter.post('/bookings/:id/inspection/dispute', ...inspectionAccess, inspectionWriteLimiter, disputeInspection);
rentalRouter.post('/bookings/:id/claim', authenticate, postFileClaim);
