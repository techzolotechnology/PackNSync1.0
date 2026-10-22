import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { aircraftUpload } from '../middleware/aircraftUpload.middleware.js';
import { requireAircraftOwner, updateAircraft, uploadAircraftDocument, submitAircraft, publishAircraft, listPublicAircraft, createCharterInquiry, hostCharterInquiries, myCharterInquiries, respondToCharterInquiry, cancelCharterInquiry, listAircraftReviews, reviewAircraft, readAircraftDocument } from '../controllers/aviation.controller.js';

export const aviationRouter = Router();
aviationRouter.get('/aircraft', listPublicAircraft);
aviationRouter.get('/inquiries/host', authenticate, hostCharterInquiries);
aviationRouter.get('/inquiries/my', authenticate, myCharterInquiries);
aviationRouter.patch('/inquiries/:id/respond', authenticate, respondToCharterInquiry);
aviationRouter.patch('/inquiries/:id/cancel', authenticate, cancelCharterInquiry);
aviationRouter.post('/aircraft/:id/inquiries', authenticate, createCharterInquiry);
aviationRouter.put('/aircraft/:vehicleId', authenticate, requireAircraftOwner, updateAircraft);
aviationRouter.post('/aircraft/:vehicleId/documents/:kind', authenticate, requireAircraftOwner, aircraftUpload.single('rcImage'), uploadAircraftDocument);
aviationRouter.post('/aircraft/:vehicleId/submit', authenticate, requireAircraftOwner, submitAircraft);
aviationRouter.patch('/aircraft/:vehicleId/publish', authenticate, requireAircraftOwner, publishAircraft);

// Mounted after the admin role and MFA gates in admin.routes.js.
export const aviationAdminRouter = Router();
aviationAdminRouter.get('/aviation', listAircraftReviews);
aviationAdminRouter.patch('/aviation/:vehicleId/review', reviewAircraft);
aviationAdminRouter.get('/aviation/:vehicleId/documents/:kind', readAircraftDocument);
