import { AppError } from './AppError.js';

export const AIRCRAFT_DOCUMENTS = {
    registration: { label: 'Aircraft registration', expires: false },
    operatorPermit: { label: 'Operator permit', expires: true },
    airworthiness: { label: 'Airworthiness document', expires: true },
    insurance: { label: 'Aircraft insurance', expires: true },
};
export function aircraftExpiry(kind, raw, now = new Date()) {
    if (!Object.hasOwn(AIRCRAFT_DOCUMENTS, kind)) throw new AppError('Unknown aircraft document type.', 400);
    if (!AIRCRAFT_DOCUMENTS[kind].expires) return null;
    const date = typeof raw === 'string' ? new Date(raw) : null;
    if (!date || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(raw) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw.slice(0, 10) || date <= now) throw new AppError('Enter a valid future document expiry date.', 400);
    return date;
}
export function aircraftInput(body = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('Enter the aircraft operator details.', 400);
    const data = {};
    for (const [key, label, max] of [['operatorName', 'Operator name', 160], ['operatorPermitNumber', 'Operator permit reference', 120], ['baseAirport', 'Base airport / helipad', 200]]) {
        if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > max) throw new AppError(`${label} is required (up to ${max} characters).`, 400);
        data[key] = body[key].trim();
    }
    const rate = Number(body.pricePerHour);
    if (!['number', 'string'].includes(typeof body.pricePerHour) || !Number.isFinite(rate) || rate < 1 || rate > 10000000) throw new AppError('Enter a valid indicative hourly charter rate.', 400);
    data.pricePerHour = Math.round(rate * 100) / 100;
    if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 3000)) throw new AppError('Description must be up to 3,000 characters.', 400);
    data.description = String(body.description || '').trim();
    return data;
}
export function missingAircraftDocuments(profile, now = new Date()) {
    return Object.entries(AIRCRAFT_DOCUMENTS).filter(([key, spec]) => {
        const doc = profile?.documents?.[key];
        return !doc?.url || spec.expires && (!doc.expiresAt || !Number.isFinite(Date.parse(doc.expiresAt)) || new Date(doc.expiresAt) <= now);
    }).map(([, spec]) => spec.label);
}
export function aircraftReady(profile, now = new Date()) {
    return profile?.status === 'APPROVED' && missingAircraftDocuments(profile, now).length === 0;
}
export function publicAircraft(profile) {
    // Documents, permit references and reviewer details stay private to host/admin.
    return {
        id: profile.id, operatorName: profile.operatorName, baseAirport: profile.baseAirport,
        pricePerHour: profile.pricePerHour, currency: profile.currency, pricingUnit: 'HOUR',
        bookingMode: 'ENQUIRY', description: profile.description,
        vehicle: {
            id: profile.vehicle.id, make: profile.vehicle.make, model: profile.vehicle.model,
            type: 'HELICOPTER', seats: profile.vehicle.seats, images: profile.vehicle.images,
        },
    };
}
