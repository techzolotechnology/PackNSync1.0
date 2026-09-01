const DEFAULT_BACKEND_ORIGIN =
    (typeof window !== 'undefined' && window.__PICKANDSYNC_CONFIG__?.SOCKET_URL)
    || 'https://p01--striped-throne--64bsjhwpv9v8.code.run';

function trimTrailingSlash(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

function apiOrigin(apiBaseUrl) {
    if (/^https?:\/\//i.test(apiBaseUrl)) {
        return apiBaseUrl.replace(/\/api$/i, '');
    }

    if (typeof window !== 'undefined') {
        return window.location.origin;
    }

    return DEFAULT_BACKEND_ORIGIN;
}

function isLocalWebDevelopment() {
    if (typeof window === 'undefined' || window.location.protocol === 'file:') return false;
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

// Every client uses the deployed PickAndSync backend by default. Environment
// variables are intentionally the only override, so local development remains
// possible without letting individual screens select a different server.
export const API_BASE_URL = trimTrailingSlash(
    import.meta.env.VITE_API_URL
        || (typeof window !== 'undefined' && window.__PICKANDSYNC_CONFIG__?.API_URL)
        || (isLocalWebDevelopment() ? '/api' : `${DEFAULT_BACKEND_ORIGIN}/api`),
);

export const BACKEND_ORIGIN = trimTrailingSlash(
    import.meta.env.VITE_SOCKET_URL || apiOrigin(API_BASE_URL),
);

export const SOCKET_BASE_URL = BACKEND_ORIGIN;
