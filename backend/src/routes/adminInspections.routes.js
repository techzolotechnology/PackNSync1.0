import { Router } from 'express';
import { listInspections, getBookingInspection, getInspectionImage, reviewInspection, exportInspection, inspectionEnabled } from '../controllers/damageInspection.controller.js';
import { inspectionWriteLimiter } from '../middleware/inspectionLimiter.js';
export const adminInspectionsRouter = Router();
// Mounted after admin authorization and MFA gate.
adminInspectionsRouter.use('/inspections', inspectionEnabled);
adminInspectionsRouter.get('/inspections', listInspections);
adminInspectionsRouter.get('/inspections/:bookingId', getBookingInspection);
adminInspectionsRouter.get('/inspections/:bookingId/images/:imageId', getInspectionImage);
adminInspectionsRouter.get('/inspections/:bookingId/export', exportInspection);
adminInspectionsRouter.post('/inspections/:bookingId/review', inspectionWriteLimiter, reviewInspection);
