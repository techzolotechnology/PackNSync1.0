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
        title: 'Thailand Group Travel from India: 6-Day Plan',
        description: 'Plan group travel to Thailand from India with a sample 6-day Bangkok and Krabi itinerary, an example budget for four friends, and practical cost-sharing tips.',
        published: '2026-10-05',
        updated: '2026-11-18',
        readMinutes: 6,
        tags: ['Thailand', 'international', 'group travel', 'checklist'],
        intro: 'Planning group travel to Thailand from India? Use this sample six-day Bangkok and Krabi plan to coordinate your itinerary, budget and shared costs with friends. Check current travel requirements and prices before booking.',
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
                heading: 'Sample 6-day Thailand itinerary for friends',
                steps: [
                    'Day 1: Arrive in Bangkok, check in and meet for dinner near your hotel.',
                    'Day 2: Visit the Grand Palace and Wat Pho, then pick a night market for dinner.',
                    'Day 3: Travel from Bangkok to Krabi, check in near Ao Nang and keep the evening free.',
                    'Day 4: Take an island tour from Krabi if the operator confirms conditions are suitable.',
                    'Day 5: Keep a flexible day for Railay Beach, local food or moving the island tour if needed.',
                    'Day 6: Check out and leave time for the airport transfer and any connecting flight.',
                ],
            },
            {
                heading: 'Example Thailand trip budget for four friends',
                paragraphs: [
                    'This six-day example allows ₹52,000 per person, or ₹2,08,000 for four travelers. These are sample amounts for planning. Check current prices for your departure city, dates and room setup before booking.',
                ],
                list: [
                    'Return flights from India: ₹24,000 per person.',
                    'Domestic transport: ₹5,000 per person.',
                    'Accommodation: ₹7,500 per person, based on ₹30,000 in shared rooms.',
                    'Meals and local transport: ₹6,000 per person.',
                    'Tours and activities: ₹5,000 per person.',
                    'Buffer for insurance and unexpected costs: ₹4,500 per person.',
                ],
                link: { label: 'Split these costs with the free trip calculator', to: '/tools/trip-cost-splitter/' },
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
    {
        slug: 'group-trip-planning-checklist-india',
        title: 'How to Plan a Group Trip with Friends in India: Checklist',
        description: 'Plan a group trip in India with a practical checklist for dates, budget, transport, stays, itinerary, shared tasks and trip expenses.',
        published: '2026-11-18',
        updated: '2026-11-18',
        readMinutes: 6,
        tags: ['group trip planner', 'India', 'checklist'],
        intro: 'Group trips work best when everyone agrees on the important decisions early. Set the dates, budget and destination together, then keep bookings, plans and shared costs easy for the whole group to follow.',
        sections: [
            {
                heading: 'Agree on dates, group size and trip length',
                paragraphs: [
                    'Start with a date range instead of asking everyone to choose from every possible weekend. Confirm who is genuinely joining before booking anything that needs a deposit. The final headcount affects room choices, vehicle size and each person’s share of the costs.',
                ],
                list: [
                    'Share two or three date options and set a clear reply deadline.',
                    'Decide how many nights the group can travel without rushing.',
                    'Ask about mobility, food or other needs that affect the plan.',
                ],
            },
            {
                heading: 'Choose a destination that fits the group',
                paragraphs: [
                    'Compare travel time, total cost and the kind of break people want. A nearby road trip may suit a short weekend, while a longer holiday can leave room for a farther destination. Check current opening times, local conditions and travel requirements before you confirm activities.',
                ],
                link: { label: 'Explore destinations for a group trip', to: '/destinations/' },
            },
            {
                heading: 'Set a budget everyone can accept',
                paragraphs: [
                    'Agree on a comfortable per-person range before choosing a stay or transport. Estimate the large shared costs first, then add food, activities and a buffer. Keep optional upgrades separate so nobody feels pressured to spend more than planned.',
                ],
                list: [
                    'Transport to and around the destination.',
                    'Accommodation, including any deposit or cancellation terms.',
                    'Meals and shared groceries.',
                    'Activities, tickets and local transport.',
                    'A contingency amount for price changes or unexpected costs.',
                ],
                link: { label: 'Estimate each person’s share with the trip cost splitter', to: '/tools/trip-cost-splitter/' },
            },
            {
                heading: 'Assign bookings and responsibilities',
                paragraphs: [
                    'Give each important booking one owner and a deadline. Keep the confirmation and cancellation details in the shared plan. Before anyone pays a deposit, confirm the dates, guest count, pickup details and refund conditions with the provider.',
                ],
                list: [
                    'Name one person to coordinate the stay and another for transport.',
                    'Share booking confirmations with everyone who is travelling.',
                    'Record who paid and whether the amount is refundable.',
                ],
            },
            {
                heading: 'Build a flexible itinerary',
                steps: [
                    'Choose one or two priorities for each day, then add nearby stops.',
                    'Group activities by area to reduce unnecessary travel.',
                    'Leave time for meals, breaks and changes to weather or timing.',
                    'Share the plan and agree which activities are optional.',
                ],
            },
            {
                heading: 'Agree how shared expenses will be split',
                paragraphs: [
                    'Decide in advance which costs are shared equally and which are personal. Add each shared payment while the details are fresh, including who paid and who took part. This avoids rebuilding the trip’s accounts from messages and receipts after everyone gets home.',
                ],
                link: { label: 'Read how to split trip expenses fairly', to: '/guides/how-to-split-trip-expenses-with-friends/' },
            },
            {
                heading: 'Use one shared place for the plan',
                paragraphs: [
                    'Keep the destination, dates, itinerary and group updates together so every traveller can catch up. PickAndSync lets a group create a trip, invite friends and organize shared trip details in one place.',
                ],
                link: { label: 'Create a group trip on PickAndSync', to: '/trips/create/' },
            },
        ],
        cta: { label: 'Start planning your group trip', to: '/trips/create/' },
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
    description: 'Practical checklists for planning group trips in India, weekend road trips, travel budgets and splitting shared costs fairly.',
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
