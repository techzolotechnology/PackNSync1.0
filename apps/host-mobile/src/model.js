export const dateKey = (value = new Date()) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const shortDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
export const money = (value, currency = 'INR') => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)); }
  catch { return `${currency} ${Number(value).toFixed(2)}`; }
};
export const vehicleName = (vehicle) => [vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || 'Vehicle';
export const hostAmount = (booking) => booking.hostAmount ?? Math.max(0, Number(booking.totalPrice || 0) - Number(booking.platformFee || 0));
export function validRange(start, end) {
  const valid = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return valid(start) && valid(end) && end > start;
}
export function schedule(bookings, now = new Date()) {
  const today = dateKey(now);
  return bookings.filter((b) => b.status === 'PAID').flatMap((booking) => [
    { kind: 'Pickup', date: booking.startDate, booking },
    { kind: 'Return', date: booking.endDate, booking },
  ]).filter((event) => dateKey(event.date) >= today).sort((a, b) => new Date(a.date) - new Date(b.date));
}
export function vehiclePayload(form) {
  const type = form.type || 'CAR';
  if (!HOSTING_CATEGORIES.some((category) => category.key === type)) throw new Error('Choose a supported hosting category.');
  if (!form.make?.trim() || !form.model?.trim() || !/^[A-Z0-9 -]{4,20}$/i.test(form.licensePlate || '')) throw new Error('Enter the make, model and a valid registration number.');
  const year = Number(form.year);
  if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) throw new Error('Enter a valid vehicle year.');
  const seats = Number(form.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 60) throw new Error('Enter a seat count from 1 to 60.');
  if (['BIKE', 'SCOOTER'].includes(type) && seats > 2) throw new Error('Bikes and scooters can have up to two seats.');
  let aircraft;
  if (type === 'HELICOPTER') {
    if (!form.operatorName?.trim() || !form.operatorPermitNumber?.trim() || !form.baseAirport?.trim()) throw new Error('Enter the operator name, permit reference and base airport / helipad.');
    const rate = Number(form.pricePerHour);
    if (!Number.isFinite(rate) || rate < 1 || rate > 10000000) throw new Error('Enter a valid indicative hourly charter rate.');
    aircraft = { operatorName: form.operatorName.trim(), operatorPermitNumber: form.operatorPermitNumber.trim(), baseAirport: form.baseAirport.trim(), pricePerHour: rate, description: '' };
  }
  return { make: form.make.trim(), model: form.model.trim(), licensePlate: form.licensePlate.trim().toUpperCase(), year, seats, type, fuelType: type === 'HELICOPTER' ? 'Aviation fuel' : form.fuelType, transmission: type === 'HELICOPTER' ? 'Operator flown' : form.transmission, images: form.images || [], ...(aircraft ? { aircraft } : {}) };
}
import { HOSTING_CATEGORIES, DOCUMENTS } from './categories';

export function aircraftVisibility(profile, now = new Date()) {
  const complete = DOCUMENTS.every((spec) => {
    const document = profile?.documents?.[spec.key];
    return document?.url && (!spec.expiry || document.expiresAt && Number.isFinite(Date.parse(document.expiresAt)) && new Date(document.expiresAt) > now);
  });
  const ready = profile?.status === 'APPROVED' && complete;
  return { ready, visible: !!profile?.isPublished && ready, label: profile?.status === 'APPROVED' && !complete ? 'Renew docs' : profile?.status || 'Setup needed' };
}
