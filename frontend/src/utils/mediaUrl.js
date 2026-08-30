import { BACKEND_ORIGIN } from '../config/backend.js';

/** Resolve API-relative upload paths for the SPA on another origin. */
export function mediaUrl(url) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    if (!url.startsWith('/uploads')) return url;

    return `${BACKEND_ORIGIN}${url}`;
}
