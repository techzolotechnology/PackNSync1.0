/**
 * International destination landing pages (/destinations/<slug>), aimed at
 * Indians planning group trips abroad. Plain JS: shared by the React pages and
 * scripts/write-spa-fallbacks.mjs (static SEO tags + sitemap).
 *
 * Keep facts evergreen. Visa rules change often, so pages link travellers to
 * check current rules instead of stating them.
 *
 * `searchTerm` is matched against trip titles/destinations, so it should be
 * the word travellers actually type when posting a trip.
 */

export const DESTINATIONS = [
    {
        slug: 'thailand',
        name: 'Thailand',
        country: 'Thailand',
        countryCode: 'TH',
        region: 'Southeast Asia',
        searchTerm: 'Thailand',
        image: '/images/stock/trip-1.jpg',
        intro: 'Bangkok nights, Phuket and Krabi beaches, island hopping and Chiang Mai cafés — Thailand is the classic first international group trip from India.',
        bestTime: 'November to February (cool and dry)',
        idealDays: '5–7 days',
        highlights: ['Bangkok street food and night markets', 'Phi Phi and Krabi island hopping', 'Phuket beaches and nightlife', 'Chiang Mai temples and old town'],
        groupTip: 'Split a private long-tail boat for island days — it costs about the same per head as a shared tour once you are 6 or more.',
    },
    {
        slug: 'dubai',
        name: 'Dubai',
        country: 'United Arab Emirates',
        countryCode: 'AE',
        region: 'Middle East',
        searchTerm: 'Dubai',
        image: '/images/stock/trip-2.jpg',
        intro: 'Desert safaris, Burj Khalifa views and a short flight from most Indian cities make Dubai an easy long-weekend group trip.',
        bestTime: 'November to March (pleasant winter weather)',
        idealDays: '4–5 days',
        highlights: ['Desert safari with dune bashing', 'Burj Khalifa and Dubai Mall', 'Dhow cruise at Dubai Marina', 'Day trip to Abu Dhabi'],
        groupTip: 'Book the desert safari as a private group vehicle — prices are per car, so a full car is the cheapest option.',
    },
    {
        slug: 'bali',
        name: 'Bali',
        country: 'Indonesia',
        countryCode: 'ID',
        region: 'Southeast Asia',
        searchTerm: 'Bali',
        image: '/images/stock/trip-3.jpg',
        intro: 'Villas with private pools, Ubud rice terraces and beach clubs — Bali is a favourite for friends trips and couples travelling together.',
        bestTime: 'April to October (dry season)',
        idealDays: '6–8 days',
        highlights: ['Ubud rice terraces and monkey forest', 'Nusa Penida day trip', 'Uluwatu temple at sunset', 'Seminyak and Canggu beach clubs'],
        groupTip: 'A shared private villa is often cheaper per person than hotel rooms for groups of 4–8.',
    },
    {
        slug: 'vietnam',
        name: 'Vietnam',
        country: 'Vietnam',
        countryCode: 'VN',
        region: 'Southeast Asia',
        searchTerm: 'Vietnam',
        image: '/images/stock/trip-5.jpg',
        intro: 'Ha Long Bay cruises, Hoi An lanterns and great food at low prices — Vietnam is ideal for a budget group trip abroad.',
        bestTime: 'February to April (pleasant across most of the country)',
        idealDays: '7–10 days',
        highlights: ['Ha Long Bay overnight cruise', 'Hoi An ancient town', 'Hanoi Old Quarter food walk', 'Ho Chi Minh City and Mekong Delta'],
        groupTip: 'Domestic flights between north and south save a full day; book them together so the group stays on one itinerary.',
    },
    {
        slug: 'singapore',
        name: 'Singapore',
        country: 'Singapore',
        countryCode: 'SG',
        region: 'Southeast Asia',
        searchTerm: 'Singapore',
        image: '/images/stock/trip-6.jpg',
        intro: 'Clean, safe and easy to get around — Singapore works well for family trips and first-time international travellers.',
        bestTime: 'Year-round; February to April is usually driest',
        idealDays: '4–5 days',
        highlights: ['Gardens by the Bay and Marina Bay Sands', 'Sentosa and Universal Studios', 'Hawker centre food trail', 'Night Safari'],
        groupTip: 'Attraction combo passes bought for the whole group usually beat individual tickets.',
    },
    {
        slug: 'malaysia',
        name: 'Malaysia',
        country: 'Malaysia',
        countryCode: 'MY',
        region: 'Southeast Asia',
        searchTerm: 'Malaysia',
        image: '/images/stock/trip-road.jpg',
        intro: 'Kuala Lumpur city life, Langkawi beaches and Penang street food — Malaysia pairs well with Singapore on one trip.',
        bestTime: 'December to April for the west coast and Langkawi',
        idealDays: '5–7 days',
        highlights: ['Petronas Towers and Batu Caves', 'Langkawi beaches and cable car', 'Penang street food in George Town', 'Genting Highlands'],
        groupTip: 'Combine Kuala Lumpur and Singapore by bus or a short flight to cover two countries in one week.',
    },
    {
        slug: 'sri-lanka',
        name: 'Sri Lanka',
        country: 'Sri Lanka',
        countryCode: 'LK',
        region: 'South Asia',
        searchTerm: 'Sri Lanka',
        image: '/images/stock/trip-1.jpg',
        intro: 'Tea country trains, Sigiriya rock and southern beaches, a short hop from South India — Sri Lanka is great for a road trip with friends.',
        bestTime: 'December to March for the west and south coasts',
        idealDays: '6–8 days',
        highlights: ['Kandy to Ella scenic train', 'Sigiriya rock fortress', 'Galle Fort and southern beaches', 'Yala national park safari'],
        groupTip: 'Hiring a van with a driver for the whole loop is the simplest way to move a group around the island.',
    },
    {
        slug: 'nepal',
        name: 'Nepal',
        country: 'Nepal',
        countryCode: 'NP',
        region: 'South Asia',
        searchTerm: 'Nepal',
        image: '/images/stock/trip-2.jpg',
        intro: 'Himalayan treks, Pokhara lakeside and Kathmandu heritage — Nepal is reachable by road or a short flight for an adventure trip together.',
        bestTime: 'October to November and March to May',
        idealDays: '6–10 days',
        highlights: ['Pokhara and Phewa Lake', 'Poon Hill or Annapurna Base Camp trek', 'Kathmandu Durbar Squares', 'Chitwan jungle safari'],
        groupTip: 'Trek guides and porters are priced per group, so trekking together lowers the cost for everyone.',
    },
    {
        slug: 'maldives',
        name: 'Maldives',
        country: 'Maldives',
        countryCode: 'MV',
        region: 'South Asia',
        searchTerm: 'Maldives',
        image: '/images/stock/trip-3.jpg',
        intro: 'Overwater villas, snorkelling and sandbanks — the Maldives suits couples, honeymoons and small groups who want a slow beach trip.',
        bestTime: 'November to April (dry season)',
        idealDays: '4–6 days',
        highlights: ['Snorkelling and diving house reefs', 'Sandbank picnics', 'Local island stays on Maafushi', 'Sunset dolphin cruise'],
        groupTip: 'Guesthouses on local islands like Maafushi cut costs a lot for groups compared with private resort islands.',
    },
    {
        slug: 'switzerland',
        name: 'Switzerland',
        country: 'Switzerland',
        countryCode: 'CH',
        region: 'Europe',
        searchTerm: 'Switzerland',
        image: '/images/stock/trip-5.jpg',
        intro: 'Alpine trains, lakes and snow peaks — Switzerland is the most-planned Europe trip for families and couples from India.',
        bestTime: 'June to September for summer; December to March for snow',
        idealDays: '7–10 days',
        highlights: ['Jungfraujoch and Interlaken', 'Lucerne and Mount Titlis', 'Glacier Express scenic train', 'Zermatt and the Matterhorn'],
        groupTip: 'Swiss Travel Pass family and group options can make rail travel much cheaper than point-to-point tickets.',
    },
];

export const findDestination = (slug) =>
    DESTINATIONS.find((d) => d.slug === String(slug || '').toLowerCase()) || null;

export const destinationSeo = (d) => ({
    title: `${d.name} Group Trip – Travel Together with Friends | PickAndSync`,
    description: `Plan a group trip to ${d.name} from India: best time (${d.bestTime}), ${d.idealDays} itinerary ideas, join trips and split costs with friends.`.slice(0, 300),
});

export const DESTINATIONS_INDEX_SEO = {
    title: 'International Group Trips from India – Top Destinations | PickAndSync',
    description: 'Plan international group trips from India to Thailand, Dubai, Bali, Vietnam, Singapore and more. Best time to visit, itinerary ideas, and travel buddies to go with.',
};

/** schema.org TouristDestination for a destination page. */
export const destinationJsonLd = (d, url) => ({
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: d.name,
    description: d.intro,
    url,
    containedInPlace: { '@type': 'Country', name: d.country },
    touristType: ['Group travellers', 'Friends', 'Couples', 'Families'],
});
