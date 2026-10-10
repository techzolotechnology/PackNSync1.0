import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { frontendBase } from '../utils/referrals.js';
import { apiPublicBase, isValidTripInvite } from '../utils/tripInvites.js';
import { isLinkPreviewBot } from '../utils/linkPreview.js';

/**
 * Link-preview pages. The website is a static SPA on GitHub Pages, so WhatsApp,
 * Telegram, X etc. cannot read per-trip Open Graph tags from it. Shared links
 * point here instead: crawlers read the tags, people are redirected to the
 * real trip page.
 */
export const shareRouter = Router();

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function previewHtml({ title, description, image, url, target }) {
    const t = escapeHtml(title);
    const d = escapeHtml(description);
    const u = escapeHtml(target);
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<meta name="robots" content="noindex" />
<link rel="canonical" href="${u}" />
<meta property="og:site_name" content="PickAndSync" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta http-equiv="refresh" content="0;url=${u}" />
</head>
<body style="font-family:system-ui,sans-serif;padding:2rem">
<p>Opening <a href="${u}">${t}</a>…</p>
</body>
</html>`;
}

function absoluteImage(req, url) {
    const fallback = `${frontendBase()}/images/stock/trip-road.jpg`;
    if (!url) return fallback;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/uploads/')) return `${apiPublicBase(req)}${url}`;
    if (url.startsWith('/')) return `${frontendBase()}${url}`;
    return fallback;
}

// GET /share/trips/:id[?invite=CODE]
shareRouter.get('/trips/:id', async (req, res) => {
    const inviteCode = req.query.invite ? String(req.query.invite) : null;

    // People go straight to the trip page without waiting on the database; the
    // trip page checks the invite code itself. Only preview bots need the tags.
    if (!isLinkPreviewBot(req.get('user-agent'))) {
        const query = inviteCode ? `?invite=${encodeURIComponent(inviteCode)}` : '';
        res.set('Cache-Control', 'no-store');
        return res.redirect(302, `${frontendBase()}/trips/${encodeURIComponent(req.params.id)}${query}`);
    }

    const trip = await prisma.trip.findUnique({
        where: { id: req.params.id },
        select: {
            id: true, title: true, destination: true, description: true, coverImageUrl: true,
            startDate: true, endDate: true, isPublic: true,
            organizer: { select: { name: true } },
        },
    }).catch(() => null);

    const viaInvite = trip && inviteCode ? await isValidTripInvite(trip.id, inviteCode) : false;
    const target = trip
        ? `${frontendBase()}/trips/${trip.id}${viaInvite ? `?invite=${encodeURIComponent(inviteCode)}` : ''}`
        : `${frontendBase()}/trips`;

    res.set('Cache-Control', 'public, max-age=300');
    res.vary('User-Agent');
    res.type('html');

    // Private trips only reveal details to people holding a valid invite link.
    if (!trip || (!trip.isPublic && !viaInvite)) {
        return res.send(previewHtml({
            title: 'Join a trip on PickAndSync',
            description: 'Plan group trips with friends, split costs, and travel together.',
            image: absoluteImage(req, null),
            url: `${apiPublicBase(req)}${req.originalUrl}`,
            target,
        }));
    }

    const organizer = trip.organizer?.name?.split(' ')[0] || 'A friend';
    const title = viaInvite
        ? `${organizer} invited you: ${trip.title}`
        : `${trip.title} – group trip to ${trip.destination}`;
    const description = `${trip.destination} · ${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)}. `
        + (trip.description?.trim() || 'Join the trip, plan together and split costs on PickAndSync.');

    res.send(previewHtml({
        title,
        description: description.slice(0, 200),
        image: absoluteImage(req, trip.coverImageUrl),
        url: `${apiPublicBase(req)}${req.originalUrl}`,
        target,
    }));
});
