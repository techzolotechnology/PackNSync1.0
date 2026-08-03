/**
 * Build an absolute URL for files served from /uploads on this API.
 * Relative paths break when the SPA is on a different origin (GitHub Pages).
 */
export function publicFileUrl(req, relativePath) {
    if (!relativePath) return relativePath;
    if (/^https?:\/\//i.test(relativePath)) return relativePath;

    const pathPart = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    const configured = (process.env.API_PUBLIC_URL || '').replace(/\/$/, '').replace(/\/api$/, '');
    if (configured) return `${configured}${pathPart}`;

    const host = req.get?.('x-forwarded-host') || req.get?.('host');
    const proto = (req.get?.('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    if (host) return `${proto}://${host}${pathPart}`;

    return pathPart;
}
