import { Router } from 'express';
import {
    createListing, getListings, getListingById, getCarSuggestions, bookRental, getMyBookings, getHostBookings,
    cancelBooking, respondToBooking, payBooking,
} from '../controllers/rental.controller.js';
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
rentalRouter.patch('/bookings/:id/cancel', authenticate, cancelBooking);
rentalRouter.patch('/bookings/:id/respond', authenticate, respondToBooking);
rentalRouter.post('/bookings/:id/pay', authenticate, payBooking);
rentalRouter.post('/bookings/:id/driver-review', authenticate, createDriverReview);
rentalRouter.get('/drivers/:userId/reviews', getDriverReviews);
