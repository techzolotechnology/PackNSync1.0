export const today = new Date().toISOString().slice(0, 10);

export const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export function rentalDays(startDate, endDate) {
  const difference = new Date(endDate) - new Date(startDate);
  if (!Number.isFinite(difference)) return 1;
  return Math.max(1, Math.ceil(difference / 86400000));
}
