export const today = new Date().toISOString().slice(0, 10);

export const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export function rentalDays(startDate, endDate) {
  const difference = new Date(endDate) - new Date(startDate);
  if (!Number.isFinite(difference)) return 1;
  return Math.max(1, Math.ceil(difference / 86400000));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "10 Oct 2026" — built by hand so it reads the same on every Android version. */
export function shortDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Both dates written as YYYY-MM-DD, and the trip ends on or after it starts. */
export function isValidDateRange(startDate, endDate) {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(String(startDate)) || !pattern.test(String(endDate))) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start;
}
