import { describe, expect, it } from 'vitest';
import { assertBusinessApproved, normalizeBusiness, publicBusinessSelect } from './rentalBusiness.js';
const shop = { hostType: 'RENTAL_SHOP', businessName: 'Example Rentals', address: 'Test address', contactNumber: '+91 9876543210', registrationReference: 'TEST-REG-123' };
describe('Rental businesses', () => {
    it('accepts a shop without optional GST', () => expect(normalizeBusiness(shop).gstNumber).toBe(''));
    it('does not accept a client-provided approval or reviewer', () => {
        const result = normalizeBusiness({ ...shop, status: 'APPROVED', reviewedBy: 'attacker', userId: 'someone-else' });
        expect(result).not.toHaveProperty('status'); expect(result).not.toHaveProperty('reviewedBy'); expect(result).not.toHaveProperty('userId');
    });
    it.each(['businessName', 'address', 'contactNumber', 'registrationReference'])('requires %s for shops', key => expect(() => normalizeBusiness({ ...shop, [key]: '' })).toThrow());
    it('rejects invalid GST, phone, oversized values and unknown host type', () => {
        for (const data of [{ ...shop, gstNumber: 'wrong' }, { ...shop, contactNumber: 'abcdefg' }, { ...shop, address: 'x'.repeat(501) }, { ...shop, hostType: 'ADMIN' }]) expect(() => normalizeBusiness(data)).toThrow();
    });
    it.each(['PENDING','REJECTED','NONE'])('blocks unapproved shop %s', status => expect(() => assertBusinessApproved({ hostType: 'RENTAL_SHOP', status })).toThrow());
    it('preserves individual hosts and approved shops', () => {
        expect(() => assertBusinessApproved(null)).not.toThrow();
        expect(() => assertBusinessApproved({ hostType: 'INDIVIDUAL', status: 'NONE' })).not.toThrow();
        expect(() => assertBusinessApproved({ hostType: 'RENTAL_SHOP', status: 'APPROVED' })).not.toThrow();
    });
    it('public listing metadata excludes contact, GST and registration details', () => expect(Object.keys(publicBusinessSelect).sort()).toEqual(['businessName','hostType','status']));
});
