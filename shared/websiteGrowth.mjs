export const GROWTH_EVENTS = {
    landing: 'Landing visits',
    planner_opened: 'Planner opened from home',
    trip_draft_started: 'Trip drafts started',
    android_store_opened: 'Android store listing opens',
    splitter_opened: 'Splitter opened from home',
    trip_created: 'Trips created',
    trip_share_opened: 'Trip shares opened',
    invite_opened: 'Valid trip invites opened',
    invite_accepted: 'Trip invites accepted',
    split_completed: 'Expense splits completed',
    split_share_opened: 'Expense shares opened',
    split_link_opened: 'Shared expense splits opened',
    rental_search: 'Rental searches',
    rental_no_results: 'Rental searches with no results',
    booking_started: 'Rental booking started',
    booking_requested: 'Rental booking requests sent',
};

export const GROWTH_SOURCES = [
    'Direct', 'Google', 'Search', 'WhatsApp', 'LinkedIn', 'Instagram',
    'Community', 'Partner', 'Trip invite', 'Shared split', 'Other referral',
];

export const GROWTH_LANDINGS = [
    'Home', 'Trips', 'Trip details', 'Trip planner', 'Expense splitter', 'Expense guide',
    'Coorg guide', 'Thailand guide', 'Other guide', 'Rentals', 'Other',
];

export const GROWTH_MARKETS = [
    'Any location', 'Other location', 'Bengaluru', 'Delhi', 'Goa', 'Mumbai', 'Pune',
    'Chandigarh', 'Faridabad', 'Gurugram', 'Karnal', 'Panipat', 'Safidon', 'Sonipat',
    'Jind', 'Gohana', 'Kurukshetra', 'Kaithal', 'Ambala', 'Rohtak', 'Hisar', 'Panchkula',
];

export function parseGrowthEvent(value) {
    const { event, source, landing, market, vehicle } = value ?? {};
    if (typeof event !== 'string' || !Object.hasOwn(GROWTH_EVENTS, event) || !GROWTH_SOURCES.includes(source)
        || !GROWTH_LANDINGS.includes(landing)) return null;

    if (event === 'rental_search' || event === 'rental_no_results') {
        if (!GROWTH_MARKETS.includes(market) || !['car', 'bike'].includes(vehicle)) return null;
        return { event, source, landing, market, vehicle };
    }

    return { event, source, landing, market: '', vehicle: '' };
}
