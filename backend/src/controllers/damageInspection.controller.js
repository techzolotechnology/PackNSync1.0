import { damageInspectionService as inspections } from '../services/damageInspection.service.js';
import { AppError } from '../utils/AppError.js';

export function inspectionEnabled(req, _res, next) {
  if (process.env.INSPECTIONS_ENABLED === 'false') return next(new AppError('Vehicle inspections are temporarily unavailable.', 503));
  // The legacy app CORS policy permits opaque origins for desktop clients.
  // Never expose private inspection evidence to an opaque page using cookies.
  if (req.get('origin') === 'null' && !req.get('authorization')?.startsWith('Bearer ')) {
    return next(new AppError('Please sign in through PickAndSync to access inspection evidence.', 403));
  }
  next();
}
export async function postCheckinInspection(req, res) {
  const data = await inspections.submit(req.params.id, 'checkin', req.body, req.user);
  res.status(201).json({ success: true, message: 'Pickup evidence recorded.', data });
}
export async function postCheckoutInspection(req, res) {
  const data = await inspections.submit(req.params.id, 'checkout', req.body, req.user);
  res.status(201).json({ success: true, message: 'Return evidence recorded for review.', data });
}
export async function getBookingInspection(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data: await inspections.getReport(req.params.id || req.params.bookingId, req.user) });
}
export async function confirmInspection(req, res) {
  res.json({ success: true, data: await inspections.confirm(req.params.id, req.body, req.user) });
}
export async function disputeInspection(req, res) {
  res.json({ success: true, data: await inspections.dispute(req.params.id, req.body, req.user) });
}
export async function getInspectionImage(req, res) {
  const image = await inspections.getImage(req.params.id || req.params.bookingId, req.params.imageId, req.user);
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' });
  res.send(image.display);
}
export async function exportInspection(req, res) {
  const report = await inspections.getReport(req.params.id || req.params.bookingId, req.user);
  res.set({ 'Cache-Control': 'private, no-store', 'Content-Disposition': 'attachment; filename="inspection-report.json"' });
  res.json({ schemaVersion: 1, exportedAt: new Date().toISOString(), ...report });
}
export async function listInspections(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data: await inspections.list(req.user, req.query.status, req.query.vehicleId) });
}
export async function reviewInspection(req, res) {
  res.json({ success: true, data: await inspections.review(req.params.bookingId, req.body, req.user) });
}
export async function postFileClaim(_req, _res) {
  throw new AppError('Insurance submission is unavailable. Please use the inspection dispute workflow.', 409);
}
