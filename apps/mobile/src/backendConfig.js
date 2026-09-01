const DEFAULT_BACKEND_ORIGIN = 'https://p01--striped-throne--64bsjhwpv9v8.code.run';

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

// Android, iOS, and Expo web all share the deployed API by default.
// Set EXPO_PUBLIC_API_URL only when deliberately testing another backend.
export const API_BASE_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_API_URL || `${DEFAULT_BACKEND_ORIGIN}/api`
);

