export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://api.pickandsync.com/api').trim().replace(/\/+$/, '');
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://pickandsync.com').trim().replace(/\/+$/, '');
export function imageUrl(value) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${API_URL.replace(/\/api$/, '')}${value}`;
  return undefined;
}
