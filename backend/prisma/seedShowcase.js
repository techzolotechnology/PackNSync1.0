/**
 * Showcase seed — safe to run against production.
 *
 * Unlike prisma/seed.js (a local dev reset that wipes every table), this script
 * only ever upserts. It exists so the live site is never an empty shell for
 * reviewers, and it refreshes its own dates on each run so the sample trips
 * stay in the future.
 *
 *   node prisma/seedShowcase.js                  ensure the sample data exists
 *   node prisma/seedShowcase.js --only-if-empty  no-op once real content exists
 *   node prisma/seedShowcase.js --remove         delete everything it created
 *
 * Showcase accounts are identified by their email domain, so nothing belonging
 * to a real user is ever touched.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HOST_DOMAIN = '@hosts.packandsync.com';

const daysFromNow = (n) => {
    const d = new Date();
    // Midnight UTC so same-day search filters never miss the window.
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + n);
    return d;
};

// No phoneNumber on purpose: it is a unique column, and a real signup using
// the same number would make the upsert fail.
const HOSTS = [
    {
        email: `ananya.sharma${HOST_DOMAIN}`,
        name: 'Ananya Sharma',
        city: 'Bangalore',
        bio: 'Weekend host in Indiranagar. Clean cars and bikes, flexible pickup.',
        languages: ['English', 'Hindi', 'Kannada'],
        interests: ['Road trips', 'Food', 'Mountains'],
        travelStyle: 'comfort',
        drivingYears: 8,
    },
    {
        email: `rohan.mehta${HOST_DOMAIN}`,
        name: 'Rohan Mehta',
        city: 'Mumbai',
        bio: 'Airport and city rentals from Andheri — cars and bikes. Instant messaging for keys.',
        languages: ['English', 'Hindi', 'Marathi'],
        interests: ['City breaks', 'Beach', 'Nightlife'],
        travelStyle: 'balanced',
        drivingYears: 12,
    },
    {
        email: `priya.nair${HOST_DOMAIN}`,
        name: 'Priya Nair',
        city: 'Kochi',
        bio: 'Organizing coastal and hill trips. Split fuel and stay fairly.',
        languages: ['English', 'Malayalam', 'Hindi'],
        interests: ['Beach', 'Hills', 'Photography'],
        travelStyle: 'budget',
    },
    {
        email: `meera.iyer${HOST_DOMAIN}`,
        name: 'Meera Iyer',
        city: 'Chennai',
        bio: 'Tea estates, scooters for Goa hops, and long drives.',
        languages: ['English', 'Tamil'],
        interests: ['Hills', 'Trekking', 'Coffee'],
        travelStyle: 'balanced',
    },
];

const VEHICLES = [
    {
        licensePlate: 'KA01AB4521',
        ownerEmail: `ananya.sharma${HOST_DOMAIN}`,
        make: 'Hyundai',
        model: 'Creta SX',
        year: 2023,
        seats: 5,
        fuelType: 'Petrol',
        transmission: 'Automatic',
        images: ['https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80'],
        listing: {
            pricePerDay: 3200,
            location: 'Bangalore',
            description: 'Automatic Creta for city and weekend drives. Pickup near Indiranagar Metro.',
            availableDays: 90,
        },
    },
    {
        licensePlate: 'KA03EV8890',
        ownerEmail: `ananya.sharma${HOST_DOMAIN}`,
        make: 'Tata',
        model: 'Nexon EV Max',
        year: 2024,
        seats: 5,
        fuelType: 'Electric',
        transmission: 'Automatic',
        images: ['https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1200&q=80'],
        listing: {
            pricePerDay: 2800,
            location: 'Bangalore',
            description: 'Electric Nexon with home charger access. Ideal for short city hops.',
            availableDays: 60,
        },
    },
    {
        licensePlate: 'MH02CD7788',
        ownerEmail: `rohan.mehta${HOST_DOMAIN}`,
        make: 'Toyota',
        model: 'Fortuner',
        year: 2022,
        seats: 7,
        fuelType: 'Diesel',
        transmission: 'Automatic',
        images: ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'],
        listing: {
            pricePerDay: 5500,
            location: 'Mumbai',
            description: '7-seater Fortuner for family trips and airport runs. Andheri East handover.',
            availableDays: 120,
        },
    },
    {
        licensePlate: 'MH12EF3344',
        ownerEmail: `rohan.mehta${HOST_DOMAIN}`,
        make: 'Honda',
        model: 'City ZX',
        year: 2021,
        seats: 5,
        fuelType: 'Petrol',
        transmission: 'Manual',
        images: ['https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80'],
        listing: {
            pricePerDay: 2200,
            location: 'Pune',
            description: 'Reliable Honda City for daily office or weekend Pune–Lonavala runs.',
            availableDays: 75,
        },
    },
    {
        // Photo is a Honda Scoopy (badge visible) — title matches the image, not Activa.
        licensePlate: 'GA01BK2201',
        ownerEmail: `meera.iyer${HOST_DOMAIN}`,
        make: 'Honda',
        model: 'Scoopy',
        year: 2023,
        type: 'SCOOTER',
        seats: 2,
        fuelType: 'Petrol',
        transmission: 'Automatic',
        images: ['https://images.unsplash.com/photo-1712213248719-aade0e02a591?auto=format&fit=crop&w=1200&q=80'],
        listing: {
            pricePerDay: 450,
            location: 'Goa',
            description: 'Easy Honda Scoopy for North Goa beach hops. Helmets available on request.',
            availableDays: 90,
        },
    },
    {
        // Photo shows Royal Enfield tank lettering, teardrop tank, round chrome headlamp.
        licensePlate: 'KA05BK3501',
        ownerEmail: `ananya.sharma${HOST_DOMAIN}`,
        make: 'Royal Enfield',
        model: 'Classic 350',
        year: 2022,
        type: 'BIKE',
        seats: 2,
        fuelType: 'Petrol',
        transmission: 'Manual',
        images: ['https://images.unsplash.com/photo-1574929465363-f6c5990656ec?auto=format&fit=crop&w=1200&q=80'],
        listing: {
            pricePerDay: 900,
            location: 'Bangalore',
            description: 'Classic 350 for weekend Coorg or Nandi Hills runs. Geared, well maintained.',
            availableDays: 90,
        },
    },
    {
        // Photo is a Honda CB100 (Honda wing + CB100 panel) — renamed from Pulsar to match.
        licensePlate: 'MH02BK1501',
        ownerEmail: `rohan.mehta${HOST_DOMAIN}`,
        make: 'Honda',
        model: 'CB100',
        year: 2021,
        type: 'BIKE',
        seats: 2,
        fuelType: 'Petrol',
        transmission: 'Manual',
        images: ['https://images.unsplash.com/photo-1527905890126-e4d915153e25?auto=format&fit=crop&w=1200&q=80'],
        listing: {
            pricePerDay: 650,
            location: 'Mumbai',
            description: 'Classic Honda CB for city rides and short getaways. Andheri pickup.',
            availableDays: 75,
        },
    },
    {
        // Official Ather Energy Unsplash shot: modern EV scooter at a charger (not retro petrol).
        licensePlate: 'KA01EV8802',
        ownerEmail: `meera.iyer${HOST_DOMAIN}`,
        make: 'Ather',
        model: '450X',
        year: 2024,
        type: 'SCOOTER',
        seats: 2,
        fuelType: 'Electric',
        transmission: 'Automatic',
        images: ['https://images.unsplash.com/photo-1623079398404-4a024f3f4aee?auto=format&fit=crop&w=1200&q=80'],
        listing: {
            pricePerDay: 700,
            location: 'Bangalore',
            description: 'Electric Ather with home charging. Quiet city scooter for Indiranagar runs.',
            availableDays: 60,
        },
    },
];

const TRIPS = [
    {
        title: 'Coorg monsoon weekend',
        organizerEmail: `priya.nair${HOST_DOMAIN}`,
        description:
            'Drive from Bangalore Saturday morning. Homestay near Madikeri, coffee estate walk, and shared dinner. Fuel and stay split equally.',
        destination: 'Coorg, Karnataka',
        coverImageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
        startsIn: 10,
        endsIn: 12,
        maxParticipants: 6,
        budgetEstimate: 6500,
        members: [
            { email: `priya.nair${HOST_DOMAIN}`, status: 'APPROVED' },
            { email: `meera.iyer${HOST_DOMAIN}`, status: 'APPROVED' },
            { email: `ananya.sharma${HOST_DOMAIN}`, status: 'PENDING' },
        ],
        itinerary: [
            { dayNumber: 1, title: 'Bangalore → Madikeri drive', location: 'Madikeri', startTime: '06:30', type: 'TRANSPORT' },
            { dayNumber: 1, title: 'Coffee estate walk', location: 'Madikeri', startTime: '16:00', type: 'ACTIVITY' },
            { dayNumber: 2, title: 'Abbey Falls and town lunch', location: 'Coorg', startTime: '10:00', type: 'ACTIVITY' },
        ],
    },
    {
        title: 'North Goa chill trip',
        organizerEmail: `priya.nair${HOST_DOMAIN}`,
        description:
            'Train or flight to Goa, shared scooter rental optional. Beach days in Anjuna and a sunset at Chapora. Food and stay split by expense tab.',
        destination: 'North Goa, Goa',
        coverImageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1400&q=80',
        startsIn: 21,
        endsIn: 25,
        maxParticipants: 8,
        budgetEstimate: 12000,
        members: [
            { email: `priya.nair${HOST_DOMAIN}`, status: 'APPROVED' },
            { email: `meera.iyer${HOST_DOMAIN}`, status: 'APPROVED' },
            { email: `rohan.mehta${HOST_DOMAIN}`, status: 'PENDING' },
        ],
        itinerary: [
            { dayNumber: 1, title: 'Check in at Anjuna', location: 'Anjuna', startTime: '14:00', type: 'STAY' },
            { dayNumber: 2, title: 'Chapora fort sunset', location: 'Chapora', startTime: '17:30', type: 'ACTIVITY' },
        ],
    },
    {
        title: 'Ooty & Coonoor hill run',
        organizerEmail: `meera.iyer${HOST_DOMAIN}`,
        description:
            'Chennai crew heading up for tea estates and light treks. Carpool seats available. Budget covers stay and shared cab legs.',
        destination: 'Ooty, Tamil Nadu',
        coverImageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80',
        startsIn: 35,
        endsIn: 38,
        maxParticipants: 5,
        budgetEstimate: 9000,
        members: [
            { email: `meera.iyer${HOST_DOMAIN}`, status: 'APPROVED' },
            { email: `priya.nair${HOST_DOMAIN}`, status: 'APPROVED' },
        ],
        itinerary: [
            { dayNumber: 1, title: 'Nilgiri toy train leg', location: 'Coonoor', startTime: '09:00', type: 'TRANSPORT' },
            { dayNumber: 2, title: 'Tea estate walk', location: 'Coonoor', startTime: '11:00', type: 'ACTIVITY' },
        ],
    },
];

const showcaseUserIds = async () => {
    const rows = await prisma.user.findMany({
        where: { email: { endsWith: HOST_DOMAIN } },
        select: { id: true },
    });
    return rows.map((r) => r.id);
};

/** True when real users have already posted trips or listed cars. */
async function platformHasRealContent() {
    const ids = await showcaseUserIds();
    const [trips, listings] = await Promise.all([
        prisma.trip.count({ where: { isPublic: true, organizerId: { notIn: ids } } }),
        prisma.rentalListing.count({ where: { isActive: true, hostId: { notIn: ids } } }),
    ]);
    return trips > 0 || listings > 0;
}

async function ensureVerified(userId) {
    const existing = await prisma.verification.count({ where: { userId } });
    if (existing > 0) return;
    const now = new Date();
    await prisma.verification.createMany({
        data: [
            { userId, documentType: 'DL', documentNumber: `DL${userId.slice(0, 8).toUpperCase()}`, status: 'VERIFIED', verifiedAt: now },
            { userId, documentType: 'AADHAAR', documentNumber: `XXXX-XXXX-${userId.slice(0, 4)}`, status: 'VERIFIED', verifiedAt: now },
        ],
    });
    await prisma.policyAcceptance.createMany({
        data: [
            { userId, policyType: 'RENTAL_TERMS', policyVersion: '1.0' },
            { userId, policyType: 'LISTING_TERMS', policyVersion: '1.0' },
        ],
        skipDuplicates: true,
    });
}

async function seed() {
    const users = new Map();

    for (const host of HOSTS) {
        const { email, ...rest } = host;
        const user = await prisma.user.upsert({
            where: { email },
            update: rest,
            create: { email, role: 'USER', ...rest },
        });
        users.set(email, user);
        await ensureVerified(user.id);
    }
    console.log(`Hosts ready: ${users.size}`);

    for (const spec of VEHICLES) {
        const owner = users.get(spec.ownerEmail);
        const { licensePlate, listing, ownerEmail: _o, ...vehicleData } = spec;

        const vehicle = await prisma.vehicle.upsert({
            where: { licensePlate },
            update: { ...vehicleData, type: vehicleData.type || 'CAR', isVerified: true },
            create: {
                ...vehicleData,
                licensePlate,
                type: vehicleData.type || 'CAR',
                isVerified: true,
                ownerId: owner.id,
            },
        });

        const window = {
            availableFrom: daysFromNow(0),
            availableTo: daysFromNow(listing.availableDays),
        };
        const existing = await prisma.rentalListing.findFirst({
            where: { vehicleId: vehicle.id, hostId: owner.id },
        });

        if (existing) {
            // Refresh the availability window so the listing never expires.
            await prisma.rentalListing.update({
                where: { id: existing.id },
                data: {
                    pricePerDay: listing.pricePerDay,
                    location: listing.location,
                    description: listing.description,
                    isActive: true,
                    ...window,
                },
            });
        } else {
            await prisma.rentalListing.create({
                data: {
                    vehicleId: vehicle.id,
                    hostId: owner.id,
                    pricePerDay: listing.pricePerDay,
                    location: listing.location,
                    description: listing.description,
                    isActive: true,
                    ...window,
                },
            });
        }
    }
    console.log(`Listings ready: ${VEHICLES.length}`);

    for (const spec of TRIPS) {
        const organizer = users.get(spec.organizerEmail);
        const dates = { startDate: daysFromNow(spec.startsIn), endDate: daysFromNow(spec.endsIn) };
        const body = {
            description: spec.description,
            destination: spec.destination,
            coverImageUrl: spec.coverImageUrl,
            maxParticipants: spec.maxParticipants,
            budgetEstimate: spec.budgetEstimate,
            status: 'OPEN',
            isPublic: true,
            ...dates,
        };

        let trip = await prisma.trip.findFirst({
            where: { title: spec.title, organizerId: organizer.id },
        });

        if (trip) {
            // Push the dates forward so the trip is always upcoming.
            trip = await prisma.trip.update({ where: { id: trip.id }, data: body });
        } else {
            trip = await prisma.trip.create({
                data: { title: spec.title, organizerId: organizer.id, ...body },
            });
        }

        for (const member of spec.members) {
            const user = users.get(member.email);
            await prisma.tripMember.upsert({
                where: { tripId_userId: { tripId: trip.id, userId: user.id } },
                update: { status: member.status },
                create: { tripId: trip.id, userId: user.id, status: member.status },
            });
        }

        for (const [order, item] of spec.itinerary.entries()) {
            const found = await prisma.itineraryItem.findFirst({
                where: { tripId: trip.id, title: item.title, dayNumber: item.dayNumber },
            });
            if (found) continue;
            await prisma.itineraryItem.create({ data: { tripId: trip.id, order, ...item } });
        }
    }
    console.log(`Trips ready: ${TRIPS.length}`);
}

async function remove() {
    const ids = await showcaseUserIds();
    if (!ids.length) {
        console.log('Nothing to remove.');
        return;
    }
    // Trips, vehicles, listings and members all cascade from the user rows.
    const { count } = await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`Removed ${count} showcase accounts and their content.`);
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--remove')) {
        await remove();
        return;
    }

    if (args.includes('--only-if-empty') && await platformHasRealContent()) {
        console.log('Real trips or listings already exist — skipping showcase seed.');
        return;
    }

    await seed();
    console.log('Showcase seed complete.');
}

main()
    .catch((err) => {
        console.error('Showcase seed failed:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
