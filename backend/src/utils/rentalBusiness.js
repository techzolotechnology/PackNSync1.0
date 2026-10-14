import { AppError } from './AppError.js';
export const publicBusinessSelect = { hostType: true, businessName: true, status: true };
export function normalizeBusiness(body) {
    if (!['INDIVIDUAL', 'RENTAL_SHOP'].includes(body.hostType)) throw new AppError('Choose individual owner or rental shop owner.', 400);
    const data = { hostType: body.hostType };
    for (const [key, max] of Object.entries({ businessName: 120, address: 500, contactNumber: 30, gstNumber: 15, registrationReference: 200 })) {
        const value = body[key] ?? '';
        if (typeof value !== 'string' || value.length > max) throw new AppError(`Invalid ${key}.`, 400);
        data[key] = value.trim();
    }
    data.gstNumber = data.gstNumber.toUpperCase();
    if (data.hostType === 'RENTAL_SHOP') {
        if (!data.businessName || !data.address || !data.contactNumber || !data.registrationReference) throw new AppError('Add the shop name, address, contact and business registration reference.', 400);
        if (!/^\+?[\d ()-]{7,30}$/.test(data.contactNumber) || data.contactNumber.replace(/\D/g, '').length < 7 || data.contactNumber.replace(/\D/g, '').length > 15) throw new AppError('Enter a valid business phone number.', 400);
        if (data.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(data.gstNumber)) throw new AppError('Enter a valid GST number or leave it blank.', 400);
    }
    return data;
}
export function assertBusinessApproved(profile) {
    if (profile?.hostType === 'RENTAL_SHOP' && profile.status !== 'APPROVED') throw new AppError('Your rental business needs admin approval before publishing or accepting new bookings.', 403);
}
