/**
 * Single source of truth for page titles, descriptions and city landing pages.
 * Plain JS (no JSX / browser APIs): imported by the React app (useSeo) and by
 * scripts/write-spa-fallbacks.mjs, which bakes these tags into each route's
 * static index.html so crawlers see them without running JavaScript.
 */

import { DESTINATIONS, DESTINATIONS_INDEX_SEO } from './destinations.js';
import { GUIDES, GUIDES_INDEX_SEO } from './guides.js';

export const SITE_URL = 'https://pickandsync.com';
export const SITE_NAME = 'PickAndSync';
export const DEFAULT_IMAGE = `${SITE_URL}/images/stock/trip-road.jpg`;
export const TRIP_SPLITTER_HEADER = {
    title: 'Split Trip Expenses with Friends',
    kicker: 'Free tool · no sign-up',
    intro: 'Use this trip expense splitter to add people and shared costs, see who owes whom, and share the result on WhatsApp—no account needed.',
};

export const DEFAULT_SEO = {
    title: 'PickAndSync | Pick & Sync Group Travel, Expense Splitter & Rentals',
    description:
        'Travel together with friends, family or your partner. Plan group trips, split costs, chat, and rent self-drive cars and bikes from verified hosts across India.',
};

/** Static, indexable routes. Keys are paths without the leading slash ('' = home). */
export const ROUTE_SEO = {
    '': DEFAULT_SEO,
    rentals: {
        title: 'Self Drive Car Rental & Bike Rental Near You | PickAndSync',
        description:
            'Rent self-drive cars, CNG cars, bikes and scooters by the day from verified local hosts. No driver, transparent per-day pricing, book in minutes.',
    },
    trips: {
        title: 'Group Trip Planner for Friends in India | PickAndSync',
        description:
            'Plan a group trip with friends in India. Browse open trips, find travel companions, share an itinerary, chat with your group and split trip costs.',
    },
    explore: {
        title: 'AI Trip Planner for Groups, Couples & Families | PickAndSync',
        description:
            'Free AI trip planner: get a day-by-day itinerary for friends, couples or family trips — places, timings and map stops — then plan it together with your group.',
    },
    destinations: DESTINATIONS_INDEX_SEO,
    guides: GUIDES_INDEX_SEO,
    'tools/trip-cost-splitter': {
        title: 'Trip Expense Splitter for Groups | PickAndSync',
        description: 'Split travel expenses with friends using a trip split calculator. Add people and shared costs, see who owes whom, and share the settlement on WhatsApp—no account needed.',
    },
    'split-expenses-app': {
        title: 'Free Split Expenses App – Splitwise & Tricount Alternative (UPI) | PickAndSync',
        description: 'A free bill-splitting app for India and a simple Splitwise & Tricount alternative: split expenses with friends, see who owes whom, and settle up over UPI — not just track it. Plan the group trip and rent the car in the same app.',
    },
    'become-a-host': {
        title: 'Rent Out Your Car or Bike in Bangalore – Earn as a Host | PickAndSync',
        description: 'List your car, CNG car or bike on PickAndSync and earn when you are not driving. ID-verified renters, your price, your dates, you approve every booking.',
    },
    'helicopter-charters': {
        title: 'Helicopter Charter Enquiries & Operator Quotes | PickAndSync',
        description: 'Browse published helicopter charter listings, view indicative hourly rates and request an operator quote for your route, date and passenger count.',
    },
    'privacy-policy': {
        title: 'Privacy Policy | PickAndSync',
        description: 'How PickAndSync collects, uses and protects your personal data.',
    },
    'delete-account': {
        title: 'Delete Your PickAndSync or PackNSync Account',
        description: 'How to request deletion of your PickAndSync or PackNSync account and associated personal data.',
    },
    'refund-policy': {
        title: 'Refund Policy | PickAndSync',
        description: 'Cancellation and refund rules for PickAndSync rentals, trips and wallet payments.',
    },
    terms: {
        title: 'Terms and Conditions | PickAndSync',
        description: 'Terms of use for PickAndSync group trips, self-drive rentals and the PickAndSync wallet.',
    },
};

/**
 * Routes that must never be indexed (account pages, auth redirects, admin).
 * Their static fallbacks get <meta name="robots" content="noindex">.
 */
export const NOINDEX_ROUTES = [
    'login',
    'register',
    'trips/create',
    'bookings',
    'verify',
    'wallet',
    'host',
    'admin',
    'reports',
    'reports/new',
];

/**
 * City landing pages: /rentals/<slug>. `location` is the search term passed to
 * the listings API, so it must match how hosts write their listing location.
 */
export const RENTAL_CITIES = [
    {
        slug: 'bangalore',
        name: 'Bangalore',
        location: 'Bangalore',
        intro:
            'Self-drive cars and bikes across Bengaluru — perfect for weekend runs to Coorg, Ooty, Chikmagalur or Nandi Hills.',
        /** Approximate one-way road distances/times from central Bengaluru. */
        getaways: [
            { name: 'Nandi Hills', km: 60, hours: '1.5', note: 'Sunrise drive, back by breakfast' },
            { name: 'Mysuru', km: 145, hours: '3', note: 'Palace, Chamundi Hills, easy day trip' },
            { name: 'Chikmagalur', km: 245, hours: '5', note: 'Coffee estates and Mullayanagiri' },
            { name: 'Coorg', km: 260, hours: '5–6', note: 'Coffee country, waterfalls, viewpoints', citySlug: 'coorg' },
            { name: 'Ooty', km: 270, hours: '6–7', note: 'Nilgiri hills via Bandipur forest', citySlug: 'ooty' },
            { name: 'Wayanad', km: 280, hours: '6', note: 'Forests, caves and treehouse stays' },
        ],
    },
    {
        slug: 'goa',
        name: 'Goa',
        location: 'Goa',
        intro:
            'Rent a self-drive car or scooty in Goa and explore North and South Goa beaches on your own schedule.',
    },
    {
        slug: 'coorg',
        name: 'Coorg',
        location: 'Coorg',
        intro:
            'Self-drive cars in Coorg for coffee estates, Abbey Falls and Madikeri viewpoints — no driver, no fixed itinerary.',
    },
    {
        slug: 'mumbai',
        name: 'Mumbai',
        location: 'Mumbai',
        intro: 'Self-drive car and bike rentals in Mumbai for city errands or weekend drives to Lonavala and Alibaug.',
    },
    {
        slug: 'pune',
        name: 'Pune',
        location: 'Pune',
        intro: 'Rent self-drive cars and bikes in Pune for Lonavala, Mahabaleshwar and Sahyadri road trips.',
    },
    {
        slug: 'ooty',
        name: 'Ooty',
        location: 'Ooty',
        intro: 'Self-drive cars in Ooty to explore the Nilgiris, tea gardens and Coonoor at your own pace.',
    },
    {
        slug: 'jaipur',
        name: 'Jaipur',
        location: 'Jaipur',
        intro: 'Rent a self-drive car in Jaipur for forts, palaces and road trips across Rajasthan.',
    },
    {
        slug: 'haryana',
        name: 'Haryana',
        location: 'Haryana',
        intro: 'Search for self-drive cars, bikes and scooters across Haryana, including Gurugram and Faridabad. Local host listings and your travel dates determine availability.',
        seoDescription: 'Search cars, bikes and scooters for rent across Haryana, including Gurugram and Faridabad. Browse local host listings and check your dates before requesting a booking.',
    },
];

export const findRentalCity = (slug) =>
    RENTAL_CITIES.find((c) => c.slug === String(slug || '').toLowerCase()) || null;

export const citySeo = (city) => ({
    title: `Self Drive Car Rental in ${city.name} – Cars & Bikes on Rent | PickAndSync`,
    description: city.seoDescription || `Book self-drive cars, CNG cars and bikes in ${city.name} from verified local hosts. Per-day pricing, no driver, easy booking. ${city.intro}`.slice(0, 300),
});

/** Every indexable path (with leading slash) — used to build sitemap.xml. */
export const SITEMAP_PATHS = [
    ...Object.keys(ROUTE_SEO).map((key) => `/${key}`),
    ...RENTAL_CITIES.map((c) => `/rentals/${c.slug}`),
    ...DESTINATIONS.map((d) => `/destinations/${d.slug}`),
    ...GUIDES.map((g) => `/guides/${g.slug}`),
];

/**
 * GitHub Pages serves each route from a folder and 301-redirects /path to
 * /path/, so canonical URLs carry the trailing slash (the final URL).
 */
export const canonicalUrl = (path) => {
    const clean = String(path || '').replace(/^\/+|\/+$/g, '');
    return clean ? `${SITE_URL}/${clean}/` : `${SITE_URL}/`;
};
