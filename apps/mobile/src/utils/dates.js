const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n) => String(n).padStart(2, '0');

// Calendar dates are YYYY-MM-DD strings; the maths runs in UTC so no time zone can shift a day.
const parseYmd = (ymd) => {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};
const toYmd = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/** Today on the phone's own calendar (not UTC, which is still yesterday before 5:30 am in India). */
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(ymd, days) {
  const date = parseYmd(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return toYmd(date);
}

export const today = localToday();

export const tomorrow = addDays(today, 1);

export function rentalDays(startDate, endDate) {
  const difference = parseYmd(endDate) - parseYmd(startDate);
  if (!Number.isFinite(difference)) return 1;
  return Math.max(1, Math.ceil(difference / 86400000));
}

/** "Sat, 11 Oct" for a YYYY-MM-DD date. */
export function weekdayDate(ymd) {
  const date = parseYmd(ymd);
  if (Number.isNaN(date.getTime())) return '';
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

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
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start;
}
