const DEFAULT_BACKEND_ORIGIN = 'https://packandsync-api.onrender.com';

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

// Android, iOS, and Expo web all share the deployed API by default.
// Set EXPO_PUBLIC_API_URL only when deliberately testing another backend.
export const API_BASE_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_API_URL || `${DEFAULT_BACKEND_ORIGIN}/api`
);

