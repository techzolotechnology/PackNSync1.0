/**
 * Travel guides (/guides/<slug>). Plain JS shared with the build script for
 * static SEO tags and the sitemap.
 *
 * Section shape: { heading, paragraphs?: string[], list?: string[], steps?: string[] }
 * Keep facts evergreen; anything that changes (visa rules, prices) should tell
 * readers to check current information instead of stating it.
 */

export const GUIDES = [
    {
        slug: 'how-to-split-trip-expenses-with-friends',
        title: 'How to Split Trip Expenses with Friends (Without the Awkwardness)',
        description: 'A simple, fair way to split group trip costs: equal vs. by-use splits, who pays what, and settling up with the fewest payments.',
        published: '2026-10-05',
        readMinutes: 5,
        tags: ['split costs', 'group travel', 'money'],
        intro: 'Money is the most common reason group trips get tense. The fix is not a cleverer spreadsheet — it is agreeing on a few rules before you leave and recording every shared expense as it happens.',
        sections: [
            {
                heading: 'Agree on the rules before the trip',
                list: [
                    'Which costs are shared (stay, car, fuel, tolls, group meals) and which are personal (shopping, solo activities).',
                    'Whether shared costs are split equally or by who used them.',
                    'One currency for the whole trip. Abroad, agree one conversion rate up front.',
                    'When you will settle up — usually within a few days of getting home.',
                ],
            },
            {
                heading: 'Equal split or split by use?',
                paragraphs: [
                    'Split equally when everyone benefits the same way: the villa, the rental car, fuel and tolls. It is simple and nobody has to track who ate the extra dessert.',
                    'Split by use when the difference is real: drinks only some people had, an activity half the group skipped, or a room upgrade one couple chose. Record the expense against only the people who shared it.',
                ],
            },
            {
                heading: 'Record expenses as they happen',
                paragraphs: [
                    'Whoever pays adds the expense straight away — what it was, how much, who paid, and who it is split between. Waiting until the end means forgotten bills and arguments about receipts.',
                    'A shared trip on PickAndSync keeps every expense in one place, visible to the whole group, so there is a single source of truth.',
                ],
            },
            {
                heading: 'Settle up with the fewest payments',
                paragraphs: [
                    'You do not need everyone to pay everyone. Work out each person\'s balance (what they paid minus their share), then have the people who owe pay the people who are owed, largest amounts first. Most groups settle in fewer transfers than people.',
                    'Example: Asha paid ₹6,000 for the car and Bilal paid ₹1,500 for dinner, split three ways (₹2,500 each). Asha is owed ₹3,500, Bilal owes ₹1,000 and Chitra owes ₹2,500 — so two UPI transfers settle the trip: Chitra → Asha ₹2,500 and Bilal → Asha ₹1,000.',
                ],
            },
            {
                heading: 'Common mistakes to avoid',
                list: [
                    'Letting one person front everything — rotate who pays so nobody carries a large balance.',
                    'Forgetting small shared costs like parking, tolls and snacks; they add up.',
                    'Mixing currencies without an agreed rate.',
                    'Settling weeks later, when nobody remembers the details.',
                ],
            },
        ],
        cta: { label: 'Try the free trip cost splitter', to: '/tools/trip-cost-splitter/' },
    },
    {
        slug: 'coorg-trip-from-bangalore-with-friends',
        title: 'Coorg Trip from Bangalore with Friends: 2-Day Self-Drive Plan',
        description: 'A 2-day Coorg itinerary from Bangalore by self-drive car: route, stops, what to see, and how to split costs per head with your group.',
        published: '2026-10-05',
        readMinutes: 6,
        tags: ['Coorg', 'Bangalore', 'road trip', 'weekend getaway'],
        intro: 'Coorg (Kodagu) is one of the most popular weekend road trips from Bangalore: about 250–270 km each way, misty coffee estates, waterfalls and viewpoints. With a self-drive car shared between 4–6 friends, it is also one of the most affordable.',
        sections: [
            {
                heading: 'Quick facts',
                list: [
                    'Distance: roughly 250–270 km from Bangalore, 5–6 hours each way via Mysuru.',
                    'Best time: October to March for pleasant weather; June to September is lush but very rainy.',
                    'Base: Madikeri town or a homestay on a coffee estate.',
                    'Group size: 4–6 people fits one SUV or a large hatchback comfortably.',
                ],
            },
            {
                heading: 'Day 1: Bangalore → Kushalnagar → Madikeri',
                steps: [
                    'Leave Bangalore early (around 6 am) to beat city traffic; breakfast on the Mysuru highway.',
                    'Stop at Namdroling Monastery (the Golden Temple) in Bylakuppe, near Kushalnagar.',
                    'Dubare Elephant Camp on the Kaveri river, if you arrive in the morning.',
                    'Check in at Madikeri or your homestay and rest.',
                    'Sunset at Raja\'s Seat in Madikeri.',
                ],
            },
            {
                heading: 'Day 2: Waterfalls, viewpoints and the drive home',
                steps: [
                    'Early jeep ride to Mandalpatti viewpoint for clouds over the hills.',
                    'Abbey (Abbi) Falls, a short walk through coffee and pepper plantations.',
                    'A coffee estate tour or a stop to buy fresh Coorg coffee.',
                    'Start back by early afternoon to reach Bangalore by night.',
                ],
            },
            {
                heading: 'Working out cost per head',
                paragraphs: [
                    'The big shared costs are the car rental, fuel, tolls and the stay; split them equally across the group. Meals and entry tickets can be split by who joined.',
                    'Add each cost to the trip as you go and divide at the end — the free trip cost splitter does the maths and tells everyone exactly who to pay.',
                ],
            },
            {
                heading: 'Tips for a smoother group road trip',
                list: [
                    'Share the driving: add two drivers for the rental and swap every couple of hours.',
                    'Download offline maps — mobile signal drops on some ghat roads.',
                    'Book homestays early for long weekends; they fill up fast.',
                    'Keep cash for small shops and parking near the falls.',
                ],
            },
        ],
        cta: { label: 'Find a self-drive car in Bangalore', to: '/rentals/bangalore/' },
    },
    {
        slug: 'thailand-group-trip-from-india-checklist',
        title: 'Thailand Group Trip from India: Planning Checklist',
        description: 'Planning a Thailand trip with friends from India? A step-by-step checklist: when to go, a 6-day route, booking as a group, money and splitting costs.',
        published: '2026-10-05',
        readMinutes: 6,
        tags: ['Thailand', 'international', 'group travel', 'checklist'],
        intro: 'Thailand is the classic first international trip for groups of friends from India — short flights, great food and beaches, and plenty to do on any budget. Use this checklist to plan it without the last-minute chaos.',
        sections: [
            {
                heading: '6–8 weeks before',
                list: [
                    'Fix dates and headcount. November to February is the cool, dry season and the most popular time to go.',
                    'Check the current entry and visa rules for Indian passport holders on the official Thai government or embassy website — they change from time to time.',
                    'Make sure every passport is valid for at least six months beyond your return date.',
                    'Decide on a rough budget per person so everyone agrees on stay and activity choices.',
                ],
            },
            {
                heading: 'A simple 6-day route',
                steps: [
                    'Days 1–2: Bangkok — temples, street food and night markets.',
                    'Day 3: Fly to Phuket or Krabi (short domestic flight).',
                    'Days 4–5: Island hopping — Phi Phi, the Krabi islands or James Bond Island.',
                    'Day 6: Beach morning, then fly home.',
                ],
            },
            {
                heading: 'Book as a group',
                list: [
                    'Book flights together so the whole group is on one itinerary.',
                    'Compare a shared villa or apartment with separate hotel rooms — for 4–8 people it is often cheaper per head.',
                    'For island days, price a private boat for the group against a shared tour.',
                    'Buy travel insurance that covers everyone for the full trip.',
                ],
            },
            {
                heading: 'Money and splitting costs',
                list: [
                    'Carry some Thai baht for street food and taxis, plus a card with low forex charges.',
                    'Agree one INR-to-THB rate for the trip so every shared expense converts the same way.',
                    'Have whoever pays add the expense immediately, with who it is split between.',
                    'Settle up within a few days of getting home, with the fewest UPI transfers.',
                ],
            },
            {
                heading: 'Before you fly',
                list: [
                    'Share the full itinerary and hotel addresses in your group trip.',
                    'Get a local eSIM or SIM for at least one person in the group.',
                    'Keep digital and printed copies of passports and bookings.',
                ],
            },
        ],
        cta: { label: 'Plan a Thailand group trip', to: '/destinations/thailand/' },
    },
];

export const findGuide = (slug) =>
    GUIDES.find((g) => g.slug === String(slug || '').toLowerCase()) || null;

export const guideSeo = (g) => ({
    title: `${g.title} | PickAndSync`,
    description: g.description,
});

export const GUIDES_INDEX_SEO = {
    title: 'Group Travel Guides – Trip Plans, Budgets & Tips | PickAndSync',
    description: 'Practical guides for travelling together: weekend road trips from Bangalore, international group trips from India, and how to split trip costs fairly.',
};

/** schema.org Article for a guide page. */
export const guideJsonLd = (g, url) => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.description,
    datePublished: g.published,
    dateModified: g.updated || g.published,
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'PickAndSync' },
    publisher: { '@type': 'Organization', name: 'PickAndSync' },
});
