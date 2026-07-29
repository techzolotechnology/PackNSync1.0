const BLOCKING_BOOKING = ['PENDING', 'CONFIRMED', 'ACTIVE', 'PAID'];
// PENDING/CONFIRMED are primary; ACTIVE/PAID kept if used later

const tokenize = (value = '') =>
    String(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .map((t) => t.trim())
        .filter((t) => t.length > 2);

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

export const scoreCarForTrip = (listing, { destination, seats, start, end }) => {
    let score = 0;
    const reasons = [];
    const loc = String(listing.location || '').toLowerCase();
    const dest = String(destination || '').toLowerCase();
    const tokens = tokenize(destination);
    const vehicle = listing.vehicle || {};

    if (dest && loc) {
        if (loc.includes(dest) || dest.includes(loc)) {
            score += 55;
            reasons.push('Near your destination');
        } else {
            const hits = tokens.filter((t) => loc.includes(t));
            if (hits.length) {
                score += 18 * Math.min(hits.length, 3);
                reasons.push(`Matches “${hits[0]}”`);
            }
        }
    }

    const needed = Number(seats) || 0;
    const vSeats = Number(vehicle.seats) || 0;
    if (needed > 0 && vSeats >= needed) {
        score += 28;
        reasons.push(`Fits ${needed}+ travelers`);
    } else if (needed > 0 && vSeats > 0) {
        score += 8;
        reasons.push(`${vSeats} seats`);
    }

    if (vehicle.isVerified) {
        score += 16;
        reasons.push('RC verified');
    }

    if (start && end) {
        score += 12;
        reasons.push('Free for your dates');
    }

    const price = Number(listing.pricePerDay) || 0;
    if (price > 0 && price <= 2500) score += 8;
    else if (price > 0 && price <= 4500) score += 4;

    if (!reasons.length) reasons.push('Available rental');

    return { score, reasons: reasons.slice(0, 3) };
};

export const findSuggestedCars = async (prisma, {
    destination,
    startDate,
    endDate,
    seats,
    limit = 6,
    excludeHostId = null,
}) => {
    if (!startDate || !endDate) {
        return { suggestions: [], meta: { reason: 'dates_required' } };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return { suggestions: [], meta: { reason: 'invalid_dates' } };
    }

    const listings = await prisma.rentalListing.findMany({
        where: {
            isActive: true,
            availableFrom: { lte: start },
            availableTo: { gte: end },
            ...(excludeHostId ? { hostId: { not: excludeHostId } } : {}),
        },
        include: {
            vehicle: true,
            host: { select: { id: true, name: true, avatarUrl: true } },
            bookings: {
                where: {
                    status: { in: BLOCKING_BOOKING },
                    startDate: { lt: end },
                    endDate: { gt: start },
                },
                select: { id: true },
            },
        },
        take: 80,
    });

    const open = listings.filter((l) => !l.bookings?.length);

    const ranked = open
        .map((listing) => {
            const { bookings: _b, ...rest } = listing;
            const { score, reasons } = scoreCarForTrip(rest, {
                destination,
                seats,
                start,
                end,
            });
            const days = Math.max(1, Math.ceil((end - start) / 86400000));
            return {
                ...rest,
                matchScore: score,
                matchReasons: reasons,
                estimatedTotal: Math.round(Number(listing.pricePerDay) * days),
                tripDays: days,
            };
        })
        .sort((a, b) => b.matchScore - a.matchScore || a.pricePerDay - b.pricePerDay);

    const local = ranked.filter((r) =>
        r.matchReasons.some((x) => /near|matches/i.test(x)),
    );
    const pool = local.length >= 2 ? local : ranked;

    return {
        suggestions: pool.slice(0, Math.min(Number(limit) || 6, 12)),
        meta: {
            totalCandidates: ranked.length,
            prioritizedLocal: local.length >= 2,
        },
    };
};
