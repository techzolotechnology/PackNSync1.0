/** Resolve API-relative upload paths for the SPA on another origin. */
export function mediaUrl(url) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    if (!url.startsWith('/uploads')) return url;

    const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const origin = apiBase.replace(/\/api$/i, '');
    if (origin) return `${origin}${url}`;

    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        return `http://127.0.0.1:3001${url}`;
    }
    return url;
}
