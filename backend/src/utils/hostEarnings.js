import { prisma } from './prisma.js';
import { AppError } from './AppError.js';
import { creditWallet } from './wallet.js';
import { notifyUser } from './notify.js';
import { earningReleaseHours, hostShareOf, round2 } from './commission.js';

/**
 * Record what the host is owed for a paid booking. Call inside the payment
 * transaction so a payment and its earning always exist together.
 */
export async function createEarningForBooking(tx, booking) {
    const releaseAt = new Date(new Date(booking.endDate).getTime() + earningReleaseHours() * 3600 * 1000);
    return tx.hostEarning.create({
        data: {
            bookingId: booking.id,
            hostId: booking.listing.hostId,
            amount: hostShareOf(booking),
            // What PickAndSync keeps: the fee minus any offer discount it paid for (can be negative)
            platformFee: round2((booking.platformFee || 0) - (booking.discountAmount || 0)),
            status: 'PENDING',
            releaseAt,
        },
    });
}

/**
 * Move one earning into the host's wallet (withdrawable cash). The status
 * claim and the wallet credit share a transaction, so an earning can only
 * ever be paid once — even if the sweep and an admin click race.
 */
export async function releaseEarning(earningId, { allowedFrom = ['PENDING', 'ON_HOLD'], note } = {}) {
    const result = await prisma.$transaction(async (tx) => {
        const earning = await tx.hostEarning.findUnique({
            where: { id: earningId },
            include: { booking: { include: { listing: { include: { vehicle: { select: { make: true, model: true } } } } } } },
        });
        if (!earning) throw new AppError('Earning not found.', 404);
        if (earning.booking.status !== 'PAID') {
            throw new AppError('This booking is no longer paid, so the earning cannot be released.', 400);
        }

        const claimed = await tx.hostEarning.updateMany({
            where: { id: earningId, status: { in: allowedFrom } },
            data: { status: 'RELEASED', releasedAt: new Date(), ...(note ? { note } : {}) },
        });
        if (claimed.count === 0) {
            const current = await tx.hostEarning.findUnique({ where: { id: earningId } });
            throw new AppError(`This earning is already ${current?.status || 'handled'}.`, 409);
        }

        if (earning.amount > 0) {
            const vehicle = earning.booking.listing.vehicle;
            await creditWallet({
                userId: earning.hostId,
                amount: earning.amount,
                type: 'EARNING',
                referenceId: `earning_${earning.id}`,
                description: `Rental earning: ${vehicle.make} ${vehicle.model}`,
                provider: 'INTERNAL',
                metadata: { bookingId: earning.bookingId, earningId: earning.id },
                tx,
            });
        }
        return earning;
    });

    await notifyUser({
        userId: result.hostId,
        type: 'PAYMENT_RECEIVED',
        title: 'Earnings available',
        body: `₹${result.amount.toLocaleString('en-IN')} from a completed rental is now in your wallet. You can withdraw it any time.`,
        data: { earningId: result.id, bookingId: result.bookingId },
    });
    return result;
}

/** Release every earning whose hold period has passed (skips disputed ON_HOLD ones). */
export async function releaseDueEarnings({ limit = 100 } = {}) {
    const due = await prisma.hostEarning.findMany({
        where: { status: 'PENDING', releaseAt: { lte: new Date() }, booking: { status: 'PAID' } },
        select: { id: true },
        orderBy: { releaseAt: 'asc' },
        take: limit,
    });
    let released = 0;
    for (const { id } of due) {
        try {
            await releaseEarning(id, { allowedFrom: ['PENDING'] });
            released += 1;
        } catch (err) {
            if (err.statusCode !== 409) console.error('[earnings] release failed', id, err.message);
        }
    }
    return { released, checked: due.length };
}

/**
 * Stop a host earning when its booking is refunded. Returns whether money had
 * already been released (then it must be recovered from the host manually).
 */
export async function cancelEarningForBooking(bookingId, tx = prisma) {
    const cancelled = await tx.hostEarning.updateMany({
        where: { bookingId, status: { in: ['PENDING', 'ON_HOLD'] } },
        data: { status: 'CANCELLED', note: 'Booking refunded' },
    });
    const earning = await tx.hostEarning.findUnique({ where: { bookingId } });
    return { cancelled: cancelled.count > 0, alreadyReleased: earning?.status === 'RELEASED', earning };
}

/** Freeze an earning while a dispute is investigated. */
export async function holdEarningForBooking(bookingId, note, tx = prisma) {
    const held = await tx.hostEarning.updateMany({
        where: { bookingId, status: 'PENDING' },
        data: { status: 'ON_HOLD', note: String(note || 'On hold for review').slice(0, 300) },
    });
    return held.count > 0;
}
