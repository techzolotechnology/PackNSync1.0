import { API_BASE_URL } from '../config/backend.js';
import { GROWTH_MARKETS } from '../../../shared/websiteGrowth.mjs';

const KEY = 'pns.website-growth';
const VISIT_WINDOW = 30 * 60 * 1000;
const campaignSources = new Map([
    ['google', 'Google'], ['whatsapp', 'WhatsApp'], ['linkedin', 'LinkedIn'],
    ['instagram', 'Instagram'], ['community', 'Community'], ['partner', 'Partner'],
]);
let attribution;

function visitSource(url, referrer) {
    if (url.pathname.startsWith('/trips/') && url.searchParams.has('invite')) return 'Trip invite';
    if (url.pathname.startsWith('/tools/trip-cost-splitter')
        && url.searchParams.get('utm_source') === 'shared-split') return 'Shared split';
    const campaign = campaignSources.get(url.searchParams.get('utm_source')?.toLowerCase());
    if (campaign) return campaign;
    if (!referrer) return 'Direct';

    const hostname = new URL(referrer).hostname;
    if (hostname === url.hostname) return 'Direct';
    if (/^(www\.)?google\.(com|co\.in|[a-z]{2})$/.test(hostname)) return 'Google';
    if (/(^|\.)(bing\.com|duckduckgo\.com|search\.yahoo\.com)$/.test(hostname)) return 'Search';
    if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(hostname)) return 'WhatsApp';
    if (/(^|\.)linkedin\.com$/.test(hostname)) return 'LinkedIn';
    if (/(^|\.)instagram\.com$/.test(hostname)) return 'Instagram';
    return 'Other referral';
}

function landingPage(pathname) {
    const path = pathname.replace(/\/$/, '');
    if (!path) return 'Home';
    if (path === '/trips') return 'Trips';
    if (path === '/trips/create') return 'Trip planner';
    if (path.startsWith('/trips/')) return 'Trip details';
    if (path === '/tools/trip-cost-splitter') return 'Expense splitter';
    if (path === '/guides/how-to-split-trip-expenses-with-friends') return 'Expense guide';
    if (path === '/guides/coorg-trip-from-bangalore-with-friends') return 'Coorg guide';
    if (path === '/guides/thailand-group-trip-from-india-checklist') return 'Thailand guide';
    if (path === '/guides' || path.startsWith('/guides/')) return 'Other guide';
    if (path === '/rentals' || path.startsWith('/rentals/')) return 'Rentals';
    return 'Other';
}

export function rentalGrowthMarket(location) {
    const city = location?.split(',')[0].trim().toLowerCase();
    if (!city) return 'Any location';
    if (city === 'bangalore') return 'Bengaluru';
    if (city === 'gurgaon') return 'Gurugram';
    return GROWTH_MARKETS.find((market) => market.toLowerCase() === city) || 'Other location';
}

export function trackWebsiteEvent(event, details) {
    if (!attribution) return;
    const { source, landing } = attribution;
    void fetch(`${API_BASE_URL}/website-growth`, {
        method: 'POST',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ event, source, landing, ...details }),
    }).catch(() => {});
}

export function initializeWebsiteGrowth() {
    if (window.location.protocol === 'file:' || navigator.globalPrivacyControl
        || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

    const url = new URL(window.location.href);
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return;
    const source = visitSource(url, document.referrer);
    const explicitSource = url.searchParams.has('utm_source') || source === 'Trip invite';
    try {
        const previous = JSON.parse(sessionStorage.getItem(KEY) || 'null');
        if (previous && Date.now() - previous.startedAt < VISIT_WINDOW
            && (!explicitSource || previous.source === source)) {
            attribution = previous;
            return;
        }
    } catch { /* Storage may be unavailable. */ }

    attribution = { source, landing: landingPage(url.pathname), startedAt: Date.now() };
    try { sessionStorage.setItem(KEY, JSON.stringify(attribution)); } catch { /* Storage may be unavailable. */ }
    trackWebsiteEvent('landing');
}
