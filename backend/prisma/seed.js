import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const daysFromNow = (n) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d;
};

async function seedVerifiedUser(userId) {
    const now = new Date();
    await prisma.verification.createMany({
        data: [
            {
                userId,
                documentType: 'DL',
                documentNumber: `DL${userId.slice(0, 8).toUpperCase()}`,
                status: 'VERIFIED',
                verifiedAt: now,
            },
            {
                userId,
                documentType: 'AADHAAR',
                documentNumber: `XXXX-XXXX-${userId.slice(0, 4)}`,
                status: 'VERIFIED',
                verifiedAt: now,
            },
        ],
    });
    await prisma.policyAcceptance.createMany({
        data: [
            { userId, policyType: 'RENTAL_TERMS', policyVersion: '1.0' },
            { userId, policyType: 'LISTING_TERMS', policyVersion: '1.0' },
            { userId, policyType: 'RIDE_TERMS', policyVersion: '1.0' },
        ],
    });
}

async function main() {
    console.log('Seeding PickAndSync with real sample data...');

    console.log('Clearing existing data...');
    await prisma.policyAcceptance.deleteMany();
    await prisma.verification.deleteMany();
    await prisma.linkedAccount.deleteMany().catch(() => {});
    await prisma.rideBooking.deleteMany();
    await prisma.rentalBooking.deleteMany();
    await prisma.rentalListing.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.announcement.deleteMany();
    await prisma.pollVote.deleteMany();
    await prisma.poll.deleteMany();
    await prisma.message.deleteMany();
    await prisma.expenseShare.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.itineraryItem.deleteMany();
    await prisma.tripMember.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.user.deleteMany();

    const admin = await prisma.user.create({
        data: {
            name: 'Kartik Gauttam',
            email: 'pincu7707@gmail.com',
            role: 'ADMIN',
            city: 'Bangalore',
            bio: 'PickAndSync admin. Review verifications and keep the platform running.',
            languages: ['English', 'Hindi'],
            interests: ['Road trips', 'City breaks'],
            travelStyle: 'balanced',
        },
    });

    const ananya = await prisma.user.create({
        data: {
            name: 'Ananya Sharma',
            email: 'ananya.sharma@example.com',
            phoneNumber: '+919876543210',
            role: 'USER',
            city: 'Bangalore',
            bio: 'Weekend host in Indiranagar. Clean cars, flexible pickup.',
            languages: ['English', 'Hindi', 'Kannada'],
            interests: ['Road trips', 'Food', 'Mountains'],
            travelStyle: 'comfort',
            drivingYears: 8,
        },
    });

    const rohan = await prisma.user.create({
        data: {
            name: 'Rohan Mehta',
            email: 'rohan.mehta@example.com',
            phoneNumber: '+919876543211',
            role: 'USER',
            city: 'Mumbai',
            bio: 'Airport and city rentals from Andheri. Instant messaging for keys.',
            languages: ['English', 'Hindi', 'Marathi'],
            interests: ['City breaks', 'Beach', 'Nightlife'],
            travelStyle: 'balanced',
            drivingYears: 12,
        },
    });

    const priya = await prisma.user.create({
        data: {
            name: 'Priya Nair',
            email: 'priya.nair@example.com',
            phoneNumber: '+919876543212',
            role: 'USER',
            city: 'Kochi',
            bio: 'Organizing coastal and hill trips. Split fuel and stay fairly.',
            languages: ['English', 'Hindi', 'Malayalam'],
            interests: ['Beach', 'Food', 'Adventure'],
            travelStyle: 'adventure',
            drivingYears: 5,
        },
    });

    const arjun = await prisma.user.create({
        data: {
            name: 'Arjun Patel',
            email: 'arjun.patel@example.com',
            phoneNumber: '+919876543213',
            role: 'USER',
            city: 'Ahmedabad',
            bio: 'Happy to join open trips and share cab or train legs.',
            languages: ['English', 'Hindi', 'Gujarati'],
            interests: ['Culture', 'Food', 'Photography'],
            travelStyle: 'budget',
            drivingYears: 3,
        },
    });

    const meera = await prisma.user.create({
        data: {
            name: 'Meera Iyer',
            email: 'meera.iyer@example.com',
            phoneNumber: '+919876543214',
            role: 'USER',
            city: 'Chennai',
            bio: 'Looking for well-planned group getaways with clear budgets.',
            languages: ['English', 'Tamil', 'Hindi'],
            interests: ['Mountains', 'Camping', 'Culture'],
            travelStyle: 'balanced',
            drivingYears: 4,
        },
    });

    for (const u of [admin, ananya, rohan, priya, arjun, meera]) {
        await seedVerifiedUser(u.id);
    }

    const creta = await prisma.vehicle.create({
        data: {
            ownerId: ananya.id,
            make: 'Hyundai',
            model: 'Creta SX',
            year: 2023,
            type: 'CAR',
            licensePlate: 'KA01AB4521',
            seats: 5,
            fuelType: 'Petrol',
            transmission: 'Automatic',
            isVerified: true,
            images: [
                'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80',
            ],
        },
    });

    const nexon = await prisma.vehicle.create({
        data: {
            ownerId: ananya.id,
            make: 'Tata',
            model: 'Nexon EV Max',
            year: 2024,
            type: 'CAR',
            licensePlate: 'KA03EV8890',
            seats: 5,
            fuelType: 'Electric',
            transmission: 'Automatic',
            isVerified: true,
            images: [
                'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1200&q=80',
            ],
        },
    });

    const fortuner = await prisma.vehicle.create({
        data: {
            ownerId: rohan.id,
            make: 'Toyota',
            model: 'Fortuner',
            year: 2022,
            type: 'CAR',
            licensePlate: 'MH02CD7788',
            seats: 7,
            fuelType: 'Diesel',
            transmission: 'Automatic',
            isVerified: true,
            images: [
                'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80',
            ],
        },
    });

    const city = await prisma.vehicle.create({
        data: {
            ownerId: rohan.id,
            make: 'Honda',
            model: 'City ZX',
            year: 2021,
            type: 'CAR',
            licensePlate: 'MH12EF3344',
            seats: 5,
            fuelType: 'Petrol',
            transmission: 'Manual',
            isVerified: true,
            images: [
                'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80',
            ],
        },
    });

    await prisma.rentalListing.createMany({
        data: [
            {
                vehicleId: creta.id,
                hostId: ananya.id,
                pricePerDay: 3200,
                location: 'Bangalore',
                description: 'Automatic Creta for city and weekend drives. Pickup near Indiranagar Metro.',
                availableFrom: daysFromNow(0),
                availableTo: daysFromNow(90),
                isActive: true,
            },
            {
                vehicleId: nexon.id,
                hostId: ananya.id,
                pricePerDay: 2800,
                location: 'Bangalore',
                description: 'Electric Nexon with home charger access. Ideal for short city hops.',
                availableFrom: daysFromNow(0),
                availableTo: daysFromNow(60),
                isActive: true,
            },
            {
                vehicleId: fortuner.id,
                hostId: rohan.id,
                pricePerDay: 5500,
                location: 'Mumbai',
                description: '7-seater Fortuner for family trips and airport runs. Andheri East handover.',
                availableFrom: daysFromNow(0),
                availableTo: daysFromNow(120),
                isActive: true,
            },
            {
                vehicleId: city.id,
                hostId: rohan.id,
                pricePerDay: 2200,
                location: 'Pune',
                description: 'Reliable Honda City for daily office or weekend Pune–Lonavala runs.',
                availableFrom: daysFromNow(1),
                availableTo: daysFromNow(75),
                isActive: true,
            },
        ],
    });

    const coorg = await prisma.trip.create({
        data: {
            title: 'Coorg monsoon weekend',
            description:
                'Drive from Bangalore Saturday morning. Homestay near Madikeri, coffee estate walk, and shared dinner. Fuel and stay split equally.',
            destination: 'Coorg, Karnataka',
            coverImageUrl:
                'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
            startDate: daysFromNow(10),
            endDate: daysFromNow(12),
            maxParticipants: 6,
            budgetEstimate: 6500,
            status: 'OPEN',
            isPublic: true,
            organizerId: priya.id,
        },
    });

    const goa = await prisma.trip.create({
        data: {
            title: 'North Goa chill trip',
            description:
                'Train/flight to Goa, shared scooter rental optional. Beach days in Anjuna and a sunset at Chapora. Food and stay split by expense tab.',
            destination: 'North Goa, Goa',
            coverImageUrl:
                'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1400&q=80',
            startDate: daysFromNow(21),
            endDate: daysFromNow(25),
            maxParticipants: 8,
            budgetEstimate: 12000,
            status: 'OPEN',
            isPublic: true,
            organizerId: priya.id,
        },
    });

    const ooty = await prisma.trip.create({
        data: {
            title: 'Ooty & Coonoor hill run',
            description:
                'Chennai crew heading up for tea estates and light treks. Carpool seats available. Budget covers stay + shared cab legs.',
            destination: 'Ooty, Tamil Nadu',
            coverImageUrl:
                'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80',
            startDate: daysFromNow(35),
            endDate: daysFromNow(38),
            maxParticipants: 5,
            budgetEstimate: 9000,
            status: 'OPEN',
            isPublic: true,
            organizerId: meera.id,
        },
    });

    await prisma.tripMember.createMany({
        data: [
            { tripId: coorg.id, userId: priya.id, status: 'APPROVED' },
            { tripId: coorg.id, userId: arjun.id, status: 'APPROVED' },
            { tripId: coorg.id, userId: ananya.id, status: 'PENDING' },
            { tripId: goa.id, userId: priya.id, status: 'APPROVED' },
            { tripId: goa.id, userId: meera.id, status: 'APPROVED' },
            { tripId: goa.id, userId: rohan.id, status: 'PENDING' },
            { tripId: ooty.id, userId: meera.id, status: 'APPROVED' },
            { tripId: ooty.id, userId: arjun.id, status: 'APPROVED' },
        ],
    });

    await prisma.itineraryItem.createMany({
        data: [
            {
                tripId: coorg.id,
                title: 'Depart Bangalore',
                description: 'Meet at Silk Board by 6:30 AM',
                location: 'Bengaluru',
                dayNumber: 1,
                startTime: '06:30',
                type: 'TRANSPORT',
                order: 1,
            },
            {
                tripId: coorg.id,
                title: 'Coffee estate walk',
                location: 'Madikeri',
                dayNumber: 1,
                startTime: '16:00',
                type: 'ACTIVITY',
                order: 2,
            },
            {
                tripId: goa.id,
                title: 'Anjuna beach morning',
                location: 'Anjuna',
                dayNumber: 2,
                startTime: '09:00',
                type: 'ACTIVITY',
                order: 1,
            },
        ],
    });

    console.log('Seed complete.');
    console.log('');
    console.log('Login via OTP (check server console if email/SMS keys are unset):');
    console.log('  Admin:  kartikguatttam@packandsync.com');
    console.log('  Host:   ananya.sharma@example.com');
    console.log('  Host:   rohan.mehta@example.com');
    console.log('  Organizer: priya.nair@example.com');
    console.log('  Traveler:  arjun.patel@example.com');
    console.log('');
    console.log('Seeded: 4 active car listings (Bangalore / Mumbai / Pune), 3 open trips (Coorg / Goa / Ooty).');
}

main()
    .catch((e) => {
        console.error('Seeding failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
