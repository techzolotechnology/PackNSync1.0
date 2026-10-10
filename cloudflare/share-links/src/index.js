/**
 * go.pickandsync.com — short trip links that open instantly.
 *
 *   /t/<tripId>[?invite=CODE]
 *
 * People are redirected straight to the trip page on the website from the
 * nearest Cloudflare location: no API call, no database, no wait for the API
 * to wake up. Link preview bots (WhatsApp, Telegram…) get the trip's Open
 * Graph page from the API, cached at the edge for 5 minutes.
 *
 * A cron trigger also pings the API every 5 minutes so Render's free plan
 * does not put it to sleep (it sleeps after 15 idle minutes).
 */

// Keep in sync with backend/src/utils/linkPreview.js.
const PREVIEW_BOT = /whatsapp|facebookexternalhit|facebot|meta-externalagent|twitterbot|telegrambot|slackbot|slack-imgproxy|linkedinbot|discordbot|pinterest|skypeuripreview|redditbot|applebot|googlebot|google-inspectiontool|bingbot|embedly|iframely|vkshare|snapchat|viber|line\/|kakaotalk|zalo|mastodon|bitlybot/i;

const TRIP_PATH = /^\/t\/([A-Za-z0-9-]{1,64})\/?$/;
const PREVIEW_TIMEOUT_MS = 8000;
const PREVIEW_CACHE_SECONDS = 300;

export function isLinkPreviewBot(userAgent) {
    const ua = String(userAgent || '').trim();
    return !ua || PREVIEW_BOT.test(ua);
}

function settings(env = {}) {
    const trim = (value, fallback) => String(value || fallback).trim().replace(/\/+$/, '');
    return {
        site: trim(env.SITE_URL, 'https://pickandsync.com'),
        api: trim(env.API_URL, 'https://api.pickandsync.com'),
    };
}

const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Shown to bots when the API cannot answer in time, so a preview still appears. */
function fallbackPreview(site, target) {
    const t = escapeHtml(target);
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Join a trip on PickAndSync</title>
<meta name="robots" content="noindex" />
<meta property="og:site_name" content="PickAndSync" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Join a trip on PickAndSync" />
<meta property="og:description" content="Plan group trips with friends, split costs, and travel together." />
<meta property="og:image" content="${escapeHtml(site)}/images/stock/trip-road.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<meta http-equiv="refresh" content="0;url=${t}" />
</head>
<body><p>Opening <a href="${t}">PickAndSync</a>…</p></body>
</html>`;
}

async function previewFor(request, ctx, previewUrl, site, target) {
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const cacheKey = new Request(previewUrl, { method: 'GET' });
    if (cache) {
        const hit = await cache.match(cacheKey);
        if (hit) return hit;
    }
    try {
        const upstream = await fetch(previewUrl, {
            headers: {
                'user-agent': request.headers.get('user-agent') || 'PickAndSync-Share',
                accept: 'text/html',
            },
            signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
        });
        if (!upstream.ok) throw new Error(`preview ${upstream.status}`);
        const res = new Response(await upstream.text(), {
            status: 200,
            headers: {
                'content-type': 'text/html; charset=utf-8',
                'cache-control': `public, max-age=${PREVIEW_CACHE_SECONDS}`,
            },
        });
        if (cache) ctx.waitUntil(cache.put(cacheKey, res.clone()));
        return res;
    } catch {
        return new Response(fallbackPreview(site, target), {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
        });
    }
}

export default {
    async fetch(request, env, ctx) {
        const { site, api } = settings(env);
        const url = new URL(request.url);
        const match = url.pathname.match(TRIP_PATH);
        if (!match) return Response.redirect(`${site}/`, 302);

        const tripId = match[1];
        const invite = url.searchParams.get('invite');
        const query = invite ? `?invite=${encodeURIComponent(invite)}` : '';
        const target = `${site}/trips/${tripId}${query}`;

        if (!isLinkPreviewBot(request.headers.get('user-agent'))) {
            return new Response(null, {
                status: 302,
                headers: { location: target, 'cache-control': 'no-store' },
            });
        }
        return previewFor(request, ctx, `${api}/share/trips/${tripId}${query}`, site, target);
    },

    async scheduled(_event, env, ctx) {
        const { api } = settings(env);
        ctx.waitUntil(fetch(`${api}/health`, {
            headers: { 'user-agent': 'PickAndSync-keepalive' },
            signal: AbortSignal.timeout(60000),
        }).catch(() => {}));
    },
};
