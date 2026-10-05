import { prisma } from './prisma.js';
import { AppError } from './AppError.js';

/**
 * Delete a user and every row that references them without ON DELETE CASCADE.
 * A plain prisma.user.delete fails with a foreign-key error for any user who
 * has chatted, paid, split an expense, or booked a rental.
 *
 * Refuses while the wallet holds money or a booking is active, so funds and
 * live rentals are never silently dropped.
 */
export async function deleteUserAccount(userId) {
    const [wallet, pendingWithdrawals, activeBookings, unpaidEarnings] = await Promise.all([
        prisma.wallet.findUnique({ where: { userId } }),
        prisma.walletTransaction.count({
            where: { wallet: { userId }, type: 'WITHDRAW', status: 'PENDING' },
        }),
        prisma.rentalBooking.count({
            where: {
                status: { in: ['PENDING', 'CONFIRMED', 'PAID'] },
                endDate: { gte: new Date() },
                OR: [{ renterId: userId }, { listing: { hostId: userId } }],
            },
        }),
        prisma.hostEarning.count({ where: { hostId: userId, status: { in: ['PENDING', 'ON_HOLD'] } } }),
    ]);

    if (wallet && wallet.balance > 0) {
        throw new AppError('Withdraw your wallet balance before deleting the account.', 400);
    }
    if (pendingWithdrawals > 0) {
        throw new AppError('A wallet withdrawal is still processing. Try again once it completes.', 400);
    }
    if (unpaidEarnings > 0) {
        throw new AppError('This host still has rental earnings waiting to be paid out. Release or cancel them first.', 400);
    }
    if (activeBookings > 0) {
        throw new AppError('Cancel or complete your active rental bookings before deleting the account.', 400);
    }

    await prisma.$transaction(async (tx) => {
        // Bookings on this user's listings, and bookings they made as a renter.
        await tx.rentalBooking.deleteMany({
            where: { OR: [{ renterId: userId }, { listing: { hostId: userId } }] },
        });

        // Payments by other users that point at trips this user organized.
        await tx.payment.updateMany({
            where: { trip: { organizerId: userId }, NOT: { userId } },
            data: { tripId: null },
        });

        await tx.expenseShare.deleteMany({ where: { userId } });
        await tx.expense.deleteMany({ where: { payerId: userId } });
        await tx.message.deleteMany({ where: { userId } });
        await tx.pollVote.deleteMany({ where: { userId } });
        await tx.announcement.deleteMany({ where: { authorId: userId } });
        await tx.payment.deleteMany({ where: { userId } });
        await tx.rideBooking.deleteMany({ where: { userId } });

        // Everything else (trips, memberships, vehicles, listings, wallet,
        // notifications, verifications, …) cascades from the user row.
        await tx.user.delete({ where: { id: userId } });
    });
}
