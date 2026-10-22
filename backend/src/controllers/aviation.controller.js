import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { AIRCRAFT_DOCUMENTS, aircraftInput, aircraftExpiry, aircraftReady, missingAircraftDocuments, publicAircraft } from '../utils/aviation.js';
import { assertFullyVerified } from '../utils/verificationHelpers.js';
import { cloudinary, isCloudinaryConfigured } from '../utils/cloudinary.js';
import { RC_UPLOAD_DIR } from '../middleware/rcUpload.middleware.js';
import { logAdminAction } from '../utils/audit.js';
import { notifyUser } from '../utils/notify.js';

const includeVehicle = { vehicle: { include: { owner: { select: { id: true, name: true, email: true, isBanned: true } } } } };
async function mutateAircraft(vehicleId, actor, action, admin = false) {
    return prisma.$transaction(async (tx) => {
        const key = `aircraft_${vehicleId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
        const record = await tx.aircraftHosting.findUnique({ where: { vehicleId }, include: includeVehicle });
        if (!record || !admin && record.vehicle.ownerId !== actor) throw new AppError('Aircraft not found in your fleet.', 404);
        return action(record, tx);
    }, { timeout: 15000 });
}
export const requireAircraftOwner = async (req, _res, next) => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.vehicleId } });
    if (!vehicle || vehicle.ownerId !== req.user.id || vehicle.type !== 'HELICOPTER') throw new AppError('Aircraft not found in your fleet.', 404);
    if (req.params.kind && !Object.hasOwn(AIRCRAFT_DOCUMENTS, req.params.kind)) throw new AppError('Unknown aircraft document type.', 400);
    next();
};
export const updateAircraft = async (req, res) => {
    const data = aircraftInput(req.body);
    const result = await mutateAircraft(req.params.vehicleId, req.user.id, async (record, tx) => {
        // Operator/base/permit edits always return the listing to review. Clients cannot set review status.
        return tx.aircraftHosting.update({ where: { id: record.id }, data: { ...data, status: 'DRAFT', isPublished: false, reviewedAt: null, reviewedBy: null, reviewNote: null } });
    });
    res.json({ success: true, data: result });
};
export const uploadAircraftDocument = async (req, res) => {
    if (!req.file) throw new AppError('Choose a document photo.', 400);
    let expiry;
    try { expiry = aircraftExpiry(req.params.kind, req.body.expiresAt); }
    catch (error) {
        await fs.unlink(req.file.path).catch(() => {});
        throw error;
    }
    const handle = await fs.open(req.file.path, 'r');
    const header = Buffer.alloc(12);
    try { await handle.read(header, 0, 12, 0); } finally { await handle.close(); }
    const actualType = header[0] === 255 && header[1] === 216 && header[2] === 255 ? 'image/jpeg'
        : header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
        : header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
    if (!actualType || actualType !== req.file.mimetype) {
        await fs.unlink(req.file.path).catch(() => {});
        throw new AppError('The file content does not match a supported photo format.', 400);
    }
    // Keep identity documents private. A cloud upload failure is surfaced rather than claiming durable storage.
    let document = { url: `/api/admin/rc-files/${req.file.filename}`, filename: req.file.filename, mimeType: actualType, expiresAt: expiry?.toISOString() || null };
    try {
        if (isCloudinaryConfigured()) {
            const uploaded = await cloudinary.uploader.upload(req.file.path, { folder: 'packandsync/aircraft-documents', type: 'authenticated', resource_type: 'image' });
            document = { ...document, url: uploaded.secure_url, publicId: uploaded.public_id, format: uploaded.format };
        }
        const result = await mutateAircraft(req.params.vehicleId, req.user.id, (record, tx) => tx.aircraftHosting.update({
            where: { id: record.id },
            data: { documents: { ...record.documents, [req.params.kind]: document }, status: 'DRAFT', isPublished: false, reviewedAt: null, reviewedBy: null, reviewNote: null },
        }));
        res.status(201).json({ success: true, data: result, message: 'Document saved privately. Submit the aircraft for operator review when all documents are ready.' });
    } catch (error) {
        await fs.unlink(req.file.path).catch(() => {});
        throw error;
    }
};
export const submitAircraft = async (req, res) => {
    await assertFullyVerified(req.user.id);
    const result = await mutateAircraft(req.params.vehicleId, req.user.id, async (record, tx) => {
        const missing = missingAircraftDocuments(record);
        if (missing.length) throw new AppError(`Complete these documents first: ${missing.join(', ')}.`, 400);
        if (record.status === 'PENDING') throw new AppError('This aircraft is already waiting for review.', 409);
        if (record.status === 'APPROVED') throw new AppError('This aircraft has already been reviewed. Use Publish to make it visible.', 409);
        return tx.aircraftHosting.update({ where: { id: record.id }, data: { status: 'PENDING', isPublished: false, reviewNote: null } });
    });
    res.json({ success: true, data: result });
};
export const publishAircraft = async (req, res) => {
    if (typeof req.body.isPublished !== 'boolean') throw new AppError('Choose publish or pause.', 400);
    if (req.body.isPublished) await assertFullyVerified(req.user.id);
    const result = await mutateAircraft(req.params.vehicleId, req.user.id, (record, tx) => {
        if (req.body.isPublished && !aircraftReady(record)) throw new AppError('Operator review and current aircraft documents are required before publishing.', 403);
        return tx.aircraftHosting.update({ where: { id: record.id }, data: { isPublished: req.body.isPublished } });
    });
    res.json({ success: true, data: result });
};
export const listPublicAircraft = async (_req, res) => {
    const records = await prisma.aircraftHosting.findMany({ where: { status: 'APPROVED', isPublished: true, vehicle: { owner: { isBanned: false } } }, include: { vehicle: true }, orderBy: { updatedAt: 'desc' }, take: 100 });
    res.json({ success: true, data: records.filter((r) => aircraftReady(r)).map(publicAircraft) });
};
export const createCharterInquiry = async (req, res) => {
    const record = await prisma.aircraftHosting.findUnique({ where: { id: req.params.id }, include: includeVehicle });
    if (!record || record.vehicle.owner.isBanned || !record.isPublished || !aircraftReady(record)) throw new AppError('This aircraft is not accepting enquiries.', 404);
    if (record.vehicle.ownerId === req.user.id) throw new AppError('You cannot enquire about your own aircraft.', 400);
    const { requestedDate, origin, destination, passengers, notes } = req.body;
    const date = new Date(requestedDate);
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    if (typeof requestedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== requestedDate || date < today) throw new AppError('Choose a valid upcoming travel date.', 400);
    for (const value of [origin, destination]) if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new AppError('Enter origin and destination, up to 200 characters each.', 400);
    const count = Number(passengers);
    if (!Number.isInteger(count) || count < 1 || count > record.vehicle.seats) throw new AppError(`Passenger count must be between 1 and ${record.vehicle.seats}.`, 400);
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) throw new AppError('Notes must be up to 2,000 characters.', 400);
    const inquiry = await prisma.charterInquiry.create({ data: { aircraftId: record.id, requesterId: req.user.id, requestedDate: date, origin: origin.trim(), destination: destination.trim(), passengers: count, notes: notes || null } });
    await notifyUser({ userId: record.vehicle.ownerId, type: 'SYSTEM', title: 'Helicopter charter enquiry', body: `${req.user.name} requested an operator quote.`, data: { charterInquiryId: inquiry.id } });
    res.status(201).json({ success: true, data: inquiry });
};
export const hostCharterInquiries = async (req, res) => {
    const data = await prisma.charterInquiry.findMany({ where: { aircraft: { vehicle: { ownerId: req.user.id } } }, include: { aircraft: { include: { vehicle: true } }, requester: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ success: true, data });
};
export const myCharterInquiries = async (req, res) => {
    const records = await prisma.charterInquiry.findMany({ where: { requesterId: req.user.id }, include: { aircraft: { include: { vehicle: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ success: true, data: records.map((r) => ({ ...r, aircraft: publicAircraft(r.aircraft) })) });
};
export const respondToCharterInquiry = async (req, res) => {
    const record = await prisma.charterInquiry.findUnique({ where: { id: req.params.id }, include: { aircraft: { include: { vehicle: true } } } });
    if (!record || record.aircraft.vehicle.ownerId !== req.user.id) throw new AppError('Charter enquiry not found.', 404);
    const { status, quotedAmount, quoteNote } = req.body;
    if (!['QUOTED', 'DECLINED'].includes(status)) throw new AppError('Choose quote or decline.', 400);
    const amount = Number(quotedAmount);
    if (status === 'QUOTED' && (!Number.isFinite(amount) || amount < 1 || amount > 100000000)) throw new AppError('Enter a valid full charter quote amount.', 400);
    if (quoteNote !== undefined && (typeof quoteNote !== 'string' || quoteNote.length > 2000)) throw new AppError('Quote notes must be up to 2,000 characters.', 400);
    if (status === 'QUOTED' && (!quoteNote || quoteNote.trim().length < 10)) throw new AppError('Include quote conditions and next steps for confirmation (at least 10 characters).', 400);
    await mutateAircraft(record.aircraft.vehicleId, req.user.id, async (current, tx) => {
        if (status === 'QUOTED' && (!aircraftReady(current) || current.vehicle.owner.isBanned || record.requestedDate < new Date(new Date().setUTCHours(0, 0, 0, 0)))) throw new AppError('A current operator review and upcoming travel date are required to quote.', 400);
        const changed = await tx.charterInquiry.updateMany({ where: { id: record.id, status: 'NEW' }, data: { status, quotedAmount: status === 'QUOTED' ? Math.round(amount * 100) / 100 : null, quoteNote: quoteNote || null } });
        if (!changed.count) throw new AppError('This enquiry has already been handled.', 409);
    });
    await notifyUser({ userId: record.requesterId, type: 'SYSTEM', title: status === 'QUOTED' ? 'Your charter quote is ready' : 'Charter enquiry declined', body: status === 'QUOTED' ? 'View the operator quote in Helicopter charters. No flight is booked or paid yet.' : 'The operator could not offer this charter.', data: { charterInquiryId: record.id } });
    res.json({ success: true });
};
export const cancelCharterInquiry = async (req, res) => {
    const result = await prisma.charterInquiry.updateMany({ where: { id: req.params.id, requesterId: req.user.id, status: { in: ['NEW', 'QUOTED'] } }, data: { status: 'CANCELLED' } });
    if (!result.count) throw new AppError('This enquiry cannot be cancelled or was not found.', 409);
    res.json({ success: true });
};
export const listAircraftReviews = async (_req, res) => {
    const data = await prisma.aircraftHosting.findMany({ include: includeVehicle, orderBy: { updatedAt: 'desc' }, take: 100 });
    res.json({ success: true, data });
};
export const reviewAircraft = async (req, res) => {
    if (!['APPROVED', 'REJECTED'].includes(req.body.status)) throw new AppError('Choose approved or rejected.', 400);
    const note = String(req.body.note || '').trim();
    if (note.length < 10 || note.length > 2000) throw new AppError('Record review findings in 10–2,000 characters.', 400);
    const result = await mutateAircraft(req.params.vehicleId, req.user.id, async (record, tx) => {
        if (req.body.status === 'APPROVED') {
            if (record.status !== 'PENDING') throw new AppError('Only submitted aircraft can be approved.', 409);
            const missing = missingAircraftDocuments(record);
            if (missing.length) throw new AppError(`Missing or expired: ${missing.join(', ')}.`, 400);
            await assertFullyVerified(record.vehicle.ownerId);
        }
        return tx.aircraftHosting.update({ where: { id: record.id }, data: { status: req.body.status, isPublished: false, reviewNote: note, reviewedAt: new Date(), reviewedBy: req.user.id }, include: { vehicle: { select: { ownerId: true } } } });
    }, true);
    await logAdminAction(req, { action: 'AIRCRAFT_REVIEW', targetType: 'AIRCRAFT', targetId: result.id, summary: `${result.status}: ${note.slice(0, 200)}` });
    await notifyUser({ userId: result.vehicle.ownerId, type: 'SYSTEM', title: 'Aircraft operator review updated', body: `${result.status}: ${note}`, data: { vehicleId: result.vehicleId } });
    res.json({ success: true, data: result });
};
export const readAircraftDocument = async (req, res) => {
    const profile = await prisma.aircraftHosting.findUnique({ where: { vehicleId: req.params.vehicleId } });
    const doc = profile?.documents?.[req.params.kind];
    if (!doc) throw new AppError('Document not found.', 404);
    res.set('Cache-Control', 'private, no-store');
    if (doc.publicId) {
        const url = cloudinary.utils.private_download_url(doc.publicId, doc.format, { type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60 });
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new AppError('Document storage could not return this file.', 502);
        res.type(doc.mimeType).send(Buffer.from(await response.arrayBuffer()));
    } else {
        if (!doc.filename || path.basename(doc.filename) !== doc.filename) throw new AppError('Invalid document record.', 400);
        res.sendFile(path.join(RC_UPLOAD_DIR, doc.filename));
    }
};
