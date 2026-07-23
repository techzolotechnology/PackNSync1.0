import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding PackAndSync database...');

    console.log('🗑️ Clearing existing data...');
    await prisma.policyAcceptance.deleteMany();
    await prisma.verification.deleteMany();
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

    await prisma.user.create({
        data: {
            name: 'Kartik Gauttam',
            email: 'kartikguatttam@packandsync.com',
            role: 'ADMIN',
            bio: 'Chief Executive Administrator of PackAndSync.',
        },
    });

    console.log('✅ PackAndSync setup complete!');
    console.log('   Admin: kartikguatttam@packandsync.com — log in via OTP');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
