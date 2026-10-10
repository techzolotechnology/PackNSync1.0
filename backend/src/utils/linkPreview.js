/**
 * Apps that fetch a link to build its preview card. They need the Open Graph
 * page; everyone else is a person and is redirected straight to the website.
 * Keep in sync with cloudflare/share-links/src/index.js.
 */
const PREVIEW_BOT = /whatsapp|facebookexternalhit|facebot|meta-externalagent|twitterbot|telegrambot|slackbot|slack-imgproxy|linkedinbot|discordbot|pinterest|skypeuripreview|redditbot|applebot|googlebot|google-inspectiontool|bingbot|embedly|iframely|vkshare|snapchat|viber|line\/|kakaotalk|zalo|mastodon|bitlybot/i;

/** A missing user agent is treated as a bot, so a preview is never lost. */
export function isLinkPreviewBot(userAgent) {
    const ua = String(userAgent || '').trim();
    return !ua || PREVIEW_BOT.test(ua);
}
