import { AppError } from './AppError.js';

/** Who an admin broadcast or offer goes to. Banned users and admins never do. */
export const AUDIENCES = ['ALL', 'HOSTS', 'ORGANIZERS', 'VERIFIED', 'CITY'];

export function audienceWhere(audience, city) {
    const base = { isBanned: false, role: 'USER' };
    switch (audience) {
        case 'HOSTS': return { ...base, rentalListings: { some: {} } };
        case 'ORGANIZERS': return { ...base, organizedTrips: { some: {} } };
        case 'VERIFIED':
            return {
                ...base,
                AND: [
                    { verifications: { some: { documentType: 'DL', status: 'VERIFIED' } } },
                    { verifications: { some: { documentType: 'AADHAAR', status: 'VERIFIED' } } },
                ],
            };
        case 'CITY': {
            const c = String(city || '').trim();
            if (c.length < 2) throw new AppError('Enter a city.', 400);
            return {
                ...base,
                OR: [
                    { city: { contains: c, mode: 'insensitive' } },
                    { rentalListings: { some: { location: { contains: c, mode: 'insensitive' } } } },
                ],
            };
        }
        default: return base;
    }
}
