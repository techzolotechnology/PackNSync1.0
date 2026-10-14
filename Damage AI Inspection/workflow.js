import { compareViews } from './vision.js';

function fail(message, statusCode = 400) { throw Object.assign(new Error(message), { statusCode }); }
const stages = ['checkin', 'checkout'];
const statuses = ['AWAITING_REVIEW', 'DISPUTED', 'PASSED', 'DAMAGE_CONFIRMED', 'INCONCLUSIVE'];
const severity = { minor: 1, moderate: 2, severe: 3 };
const includeBooking = { listing: { include: { vehicle: true, host: { select: { id: true, name: true } } } }, renter: { select: { id: true, name: true } } };

export function createInspectionWorkflow({ db, prepareEvidence }) {
  async function authorized(bookingId, actor, client = db) {
    if (typeof bookingId !== 'string' || bookingId.length > 80) fail('Invalid booking ID.');
    const booking = await client.rentalBooking.findUnique({ where: { id: bookingId }, include: includeBooking });
    if (!booking) fail('Booking not found.', 404);
    if (actor.role !== 'ADMIN' && actor.id !== booking.renterId && actor.id !== booking.listing.hostId) fail('You cannot access this booking inspection.', 403);
    return booking;
  }
  async function locked(bookingId, actor, operation) {
    return db.$transaction(async tx => {
      // All inspection writes and earning releases serialize on the same booking.
      await tx.$queryRaw`SELECT "id" FROM "rental_bookings" WHERE "id" = ${bookingId} FOR UPDATE`;
      const booking = await authorized(bookingId, actor, tx);
      return operation(tx, booking);
    }, { maxWait: 10000, timeout: 20000 });
  }
  async function event(tx, record, actor, action, data = {}) {
    await tx.inspectionEvent.create({ data: { inspectionId: record.id, actorId: actor.id, action, data } });
  }
  function party(booking, actor) {
    if (![booking.renterId, booking.listing.hostId].includes(actor.id)) fail('Only the host or renter can sign off or record evidence.', 403);
  }
  function validateReading(value, label, max) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) fail(`Invalid ${label}.`);
    return value;
  }
  function snapshotKey(snapshot) {
    return JSON.stringify({ odometer: snapshot.odometer, fuelPercent: snapshot.fuelPercent,
      images: snapshot.images.map(image => ({ angle: image.angle, sha256: image.sha256, condition: image.condition,
        findings: image.damages.map(({type,severity,note}) => ({type,severity,note})) })).sort((a,b) => a.angle.localeCompare(b.angle)) });
  }
  async function submit(bookingId, stage, payload, actor) {
    if (!stages.includes(stage)) fail('Invalid inspection stage.');
    const booking = await authorized(bookingId, actor);
    party(booking, actor);
    if (booking.status !== 'PAID') fail('Only paid bookings can be inspected.', 409);
    if (payload.consent !== true) fail('Confirm your consent to store inspection evidence.');
    const odometer = validateReading(payload.odometer, 'odometer', 9999999);
    const fuelPercent = validateReading(payload.fuelPercent, 'fuel level', 100);
    const prepared = await prepareEvidence(payload.images);
    const completedAt = new Date().toISOString();
    const snapshot = { provider: 'pickandsync-owned', stage, completedAt, submittedBy: actor.id,
      consent: { at: completedAt, version: 'inspection-evidence-v1' }, odometer, fuelPercent,
      automatedDetection: false, images: prepared.map(item => item.metadata), damages: prepared.flatMap(item => item.metadata.damages) };
    await locked(bookingId, actor, async (tx, currentBooking) => {
      if (currentBooking.status !== 'PAID') fail('Booking is no longer paid.', 409);
      let record = await tx.rentalInspection.findUnique({ where: { bookingId } });
      if (record?.[stage]) {
        if (snapshotKey(record[stage]) !== snapshotKey(snapshot)) fail('Submitted evidence is immutable. Raise a dispute to correct it.', 409);
        return; // exact retry is idempotent
      }
      if (stage === 'checkout' && !record?.checkin) fail('Record pickup evidence before return.', 409);
      const vehicleId = currentBooking.listing.vehicle.id;
      if (record && record.vehicleId !== vehicleId) fail('The vehicle no longer matches pickup evidence.', 409);
      if (stage === 'checkout' && record.checkin.odometer !== null && odometer !== null && odometer < record.checkin.odometer) fail('Return odometer cannot be lower than pickup.');
      const confirmations = { ...(record?.confirmations || {}), [stage]: { [actor.id]: { at: completedAt, comment: 'Submitted evidence' } } };
      const comparison = stage === 'checkout'
        ? snapshot.images.map(image => compareViews(record.checkin.images.find(prior => prior.angle === image.angle), image)) : [];
      const data = { [stage]: snapshot, confirmations, reviewStatus: 'AWAITING_REVIEW', comparison };
      record = record ? await tx.rentalInspection.update({ where: { id: record.id }, data: { ...data, version: { increment: 1 } } })
        : await tx.rentalInspection.create({ data: { bookingId, vehicleId, ...data } });
      await tx.inspectionImage.createMany({ data: prepared.map(item => ({ id: item.metadata.id, inspectionId: record.id,
        stage, angle: item.metadata.angle, sha256: item.metadata.sha256, original: item.original, display: item.display })) });
      await tx.hostEarning.updateMany({ where: { bookingId, status: 'PENDING' }, data: { status: 'ON_HOLD', note: 'Inspection awaiting review' } });
      await event(tx, record, actor, `SUBMIT_${stage.toUpperCase()}`, { imageHashes: snapshot.images.map(({angle,sha256}) => ({angle,sha256})), odometer, fuelPercent });
    });
    return getReport(bookingId, actor);
  }
  async function confirm(bookingId, payload, actor) {
    if (!stages.includes(payload.stage)) fail('Invalid confirmation stage.');
    if (payload.comment !== undefined && (typeof payload.comment !== 'string' || payload.comment.length > 1000)) fail('Comment must be at most 1000 characters.');
    await locked(bookingId, actor, async (tx, booking) => {
      party(booking, actor);
      const record = await tx.rentalInspection.findUnique({ where: { bookingId } });
      if (!record?.[payload.stage]) fail('Evidence has not been submitted for this stage.', 409);
      if (record.confirmations?.[payload.stage]?.[actor.id]) return;
      const confirmations = { ...record.confirmations, [payload.stage]: { ...record.confirmations[payload.stage],
        [actor.id]: { at: new Date().toISOString(), comment: payload.comment?.trim() || '' } } };
      await tx.rentalInspection.update({ where: { id: record.id }, data: { confirmations, version: { increment: 1 } } });
      await event(tx, record, actor, 'CONFIRM', { stage: payload.stage, comment: payload.comment || '' });
    });
    return getReport(bookingId, actor);
  }
  function reasonText(reason) {
    if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 2000) fail('Provide a reason between 10 and 2000 characters.');
    return reason.trim();
  }
  async function dispute(bookingId, payload, actor) {
    const reason = reasonText(payload.reason);
    await locked(bookingId, actor, async (tx, booking) => {
      party(booking, actor);
      const record = await tx.rentalInspection.findUnique({ where: { bookingId } });
      if (!record) fail('No inspection evidence exists.', 409);
      let reportId = record.reportId;
      const existing = reportId ? await tx.report.findUnique({ where: { id: reportId } }) : null;
      if (!existing || ['RESOLVED','DISMISSED'].includes(existing.status)) {
        const report = await tx.report.create({ data: { reporterId: actor.id, category: 'VEHICLE_DAMAGE', targetType: 'BOOKING',
          targetId: bookingId, bookingId, subject: 'Vehicle inspection dispute', description: reason, status: 'OPEN' } });
        reportId = report.id;
      } else {
        await tx.reportMessage.create({ data: { reportId, authorId: actor.id, body: reason } });
      }
      await tx.rentalInspection.update({ where: { id: record.id }, data: { reviewStatus: 'DISPUTED', reportId,
        review: { status: 'DISPUTED', reason, by: actor.id, at: new Date().toISOString() }, version: { increment: 1 } } });
      await tx.hostEarning.updateMany({ where: { bookingId, status: 'PENDING' }, data: { status: 'ON_HOLD', note: 'Inspection dispute' } });
      await event(tx, record, actor, 'DISPUTE', { reason, reportId });
    });
    return getReport(bookingId, actor);
  }
  async function review(bookingId, payload, actor) {
    if (actor.role !== 'ADMIN') fail('Admin review required.', 403);
    if (!['PASSED','DAMAGE_CONFIRMED','INCONCLUSIVE'].includes(payload.decision)) fail('Invalid review decision.');
    if (!Number.isInteger(payload.expectedVersion) || payload.expectedVersion < 1) fail('Refresh evidence before submitting a review.');
    const reason = reasonText(payload.reason);
    let quote = null;
    if (payload.quote) {
      const q = payload.quote;
      if (q.currency !== 'INR' || typeof q.total !== 'number' || !Number.isFinite(q.total) || q.total <= 0 || q.total > 10000000 || Math.abs(Math.round(q.total*100) - q.total*100) > 0.000001 ||
        typeof q.workshop !== 'string' || !q.workshop.trim() || q.workshop.length > 160 || typeof q.reference !== 'string' || !q.reference.trim() || q.reference.length > 300) fail('Provide a valid workshop quote in INR with reference and amount.');
      quote = { total: q.total, currency: 'INR', workshop: q.workshop.trim(), reference: q.reference.trim(), binding: false };
    }
    await locked(bookingId, actor, async (tx, booking) => {
      if ([booking.renterId,booking.listing.hostId].includes(actor.id)) fail('An independent admin must review their own rental.', 403);
      const record = await tx.rentalInspection.findUnique({ where: { bookingId } });
      if (!record?.checkout) fail('Return evidence is required for a decision.', 409);
      if (record.version !== payload.expectedVersion) fail('Inspection changed while you reviewed it. Refresh and review again.', 409);
      if (payload.decision === 'PASSED' && !stages.every(stage => [booking.renterId,booking.listing.hostId].every(id => record.confirmations?.[stage]?.[id]))) fail('Host and renter must confirm both stages before a pass.', 409);
      if (payload.decision !== 'DAMAGE_CONFIRMED' && quote) fail('Only a confirmed-damage decision may record a repair quote.');
      const review = { status: payload.decision, reason, quote, by: actor.id, at: new Date().toISOString() };
      let reportId = record.reportId;
      if (payload.decision === 'DAMAGE_CONFIRMED' && !reportId) {
        const report = await tx.report.create({ data: { reporterId: actor.id, category: 'VEHICLE_DAMAGE', targetType: 'BOOKING',
          targetId: bookingId, bookingId, subject: 'Inspection damage review', description: reason, status: 'IN_REVIEW' } });
        reportId = report.id;
      }
      if (payload.decision === 'PASSED' && reportId) await tx.report.update({ where: { id: reportId }, data: { status: 'RESOLVED', resolution: reason, resolvedAt: new Date() } });
      await tx.rentalInspection.update({ where: { id: record.id }, data: { reviewStatus: payload.decision, review, reportId, version: { increment: 1 } } });
      const openReports = await tx.report.count({ where: { bookingId, status: { in: ['OPEN','IN_REVIEW'] } } });
      if (payload.decision === 'PASSED' && !openReports) await tx.hostEarning.updateMany({ where: { bookingId, status: 'ON_HOLD', note: { startsWith: 'Inspection' } }, data: { status: 'PENDING', note: 'Inspection passed; standard payout schedule applies' } });
      else await tx.hostEarning.updateMany({ where: { bookingId, status: 'PENDING' }, data: { status: 'ON_HOLD', note: 'Inspection awaiting resolution' } });
      await event(tx, record, actor, 'REVIEW', review);
      // No liability determination, wallet deduction, insurance or payout action.
    });
    return getReport(bookingId, actor);
  }
  async function getReport(bookingId, actor) {
    const booking = await authorized(bookingId, actor);
    const record = await db.rentalInspection.findUnique({ where: { bookingId }, include: { events: { orderBy: { createdAt: 'asc' } } } });
    const base = actor.role === 'ADMIN' ? `/admin/inspections/${bookingId}/images` : `/rentals/bookings/${bookingId}/inspection/images`;
    function publicSnapshot(snapshot) {
      if (!snapshot) return null;
      return { ...snapshot, images: snapshot.images.map(({ descriptor, ...image }) => ({ ...image, url: `${base}/${image.id}` })) };
    }
    const prior = record?.checkin?.damages || [];
    const newDamages = (record?.checkout?.damages || []).filter(damage => {
      const old = prior.filter(item => item.part === damage.part && item.type === damage.type);
      return !old.length || severity[damage.severity] > Math.max(...old.map(item => severity[item.severity]));
    });
    return { bookingId, hasCheckin: Boolean(record?.checkin), hasCheckout: Boolean(record?.checkout),
      checkin: publicSnapshot(record?.checkin), checkout: publicSnapshot(record?.checkout), comparison: record?.comparison || [],
      confirmations: record?.confirmations || {}, review: record?.review || { status: record?.reviewStatus || 'NOT_STARTED' },
      reviewStatus: record?.reviewStatus || 'NOT_STARTED', events: record?.events || [], version: record?.version || 0,
      reportId: record?.reportId || null, newDamages, estimate: { status: 'quote_required', binding: false }, claim: null,
      summary: { status: record?.reviewStatus || 'NOT_STARTED', damageCount: newDamages.length, claimStatus: 'disabled' },
      vehicle: { id: booking.listing.vehicle.id, make: booking.listing.vehicle.make, model: booking.listing.vehicle.model, type: booking.listing.vehicle.type, licensePlate: booking.listing.vehicle.licensePlate }, renter: booking.renter, host: booking.listing.host,
      financialNotice: 'A review or quote does not charge a wallet or establish insurance coverage.' };
  }
  async function getImage(bookingId, imageId, actor) {
    await authorized(bookingId, actor);
    if (typeof imageId !== 'string' || imageId.length > 80) fail('Invalid image ID.');
    const image = await db.inspectionImage.findFirst({ where: { id: imageId, inspection: { bookingId } }, select: { display: true, sha256: true } });
    if (!image) fail('Inspection image not found.', 404);
    return image;
  }
  async function list(actor, status, vehicleId) {
    if (actor.role !== 'ADMIN') fail('Admin required.', 403);
    if (status && !statuses.includes(status)) fail('Invalid inspection status.');
    if (vehicleId && (typeof vehicleId !== 'string' || vehicleId.length > 80)) fail('Invalid vehicle history filter.');
    return db.rentalInspection.findMany({ where: { ...(status ? { reviewStatus: status } : {}), ...(vehicleId ? { vehicleId } : {}) }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { bookingId: true, reviewStatus: true, createdAt: true, updatedAt: true, booking: { include: includeBooking } } }).then(records => records.map(record => ({
        bookingId: record.bookingId, reviewStatus: record.reviewStatus, createdAt: record.createdAt, updatedAt: record.updatedAt,
        vehicle: record.booking.listing.vehicle, renter: record.booking.renter, host: record.booking.listing.host,
      })));
  }
  return { submit, confirm, dispute, review, getReport, getImage, list };
}
