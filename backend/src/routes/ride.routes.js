import { Router } from 'express';
import {
    getRideOptions,
    bookRide,
    getMyRides,
    getLinkedAccounts,
    linkAccount,
    handleUberCallback,
    sendOTP,
    verifyOTP,
    getProviderStatus,
    getUberSetup,
} from '../controllers/ride.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const rideRouter = Router();

// Price & Bookings
rideRouter.get('/providers', getProviderStatus);
rideRouter.get('/uber/setup', getUberSetup);
rideRouter.get('/compare', authenticate, getRideOptions);
rideRouter.post('/book', authenticate, bookRide);
rideRouter.get('/my', authenticate, getMyRides);

// Account Linking
rideRouter.get('/linked-accounts', authenticate, getLinkedAccounts);
rideRouter.post('/link-account', authenticate, linkAccount);

// Auth Providers
rideRouter.get('/auth/uber/callback', handleUberCallback); // Public for Uber redirect
rideRouter.post('/auth/otp/send', authenticate, sendOTP);
rideRouter.post('/auth/otp/verify', authenticate, verifyOTP);
