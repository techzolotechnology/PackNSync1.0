import { describe, expect, it } from 'vitest';
import { AIRCRAFT_DOCUMENTS, aircraftInput, aircraftExpiry, aircraftReady, missingAircraftDocuments, publicAircraft } from './aviation.js';
import { normalizeVehicleType, assertRoadVehicle } from './vehicleCategories.js';

const documents = Object.fromEntries(Object.keys(AIRCRAFT_DOCUMENTS).map((key) => [key, { url: '/private.jpg', expiresAt: '2099-12-31T00:00:00.000Z' }]));
describe('hosting categories and aircraft rules', () => {
    it.each(['CAR', 'BIKE', 'SCOOTER', 'HELICOPTER'])('preserves %s as its real category', (type) => expect(normalizeVehicleType(type.toLowerCase())).toBe(type));
    it('rejects unknown categories rather than silently publishing a car', () => expect(() => normalizeVehicleType('SPACESHIP')).toThrow());
    it('keeps helicopter charters out of daily road rentals', () => {
        expect(() => assertRoadVehicle({ type: 'HELICOPTER' })).toThrow(/charter/);
        expect(() => assertRoadVehicle({ type: 'SCOOTER' })).not.toThrow();
    });
    it('never accepts client-supplied operator approval, documents or publication', () => {
        const result = aircraftInput({ operatorName: 'Test operator', operatorPermitNumber: 'Test reference', baseAirport: 'Test base', pricePerHour: 50000, status: 'APPROVED', isPublished: true, documents });
        expect(result).not.toHaveProperty('status');
        expect(result).not.toHaveProperty('documents');
        expect(result).not.toHaveProperty('isPublished');
    });
    it.each([null, [], {}, { operatorName: 'Test' }])('rejects incomplete operator details %j', (value) => expect(() => aircraftInput(value)).toThrow());
    it('requires all four evidence types and current expiry dates', () => {
        expect(missingAircraftDocuments({ documents })).toHaveLength(0);
        expect(missingAircraftDocuments({ documents: { ...documents, insurance: { url: '/private.jpg', expiresAt: '2020-01-01' } } })).toEqual(['Aircraft insurance']);
        expect(aircraftReady({ status: 'PENDING', documents })).toBe(false);
        expect(aircraftReady({ status: 'APPROVED', documents })).toBe(true);
    });
    it.each(['2099-02-30', 'invalid', '2000-01-01', '2099-13-01'])('rejects invalid or past expiry %s', (value) => expect(() => aircraftExpiry('insurance', value)).toThrow());
    it('blocks prototype names as document types', () => expect(() => aircraftExpiry('__proto__', '2099-01-01')).toThrow());
    it('never exposes operator documents, permit references or personal emails publicly', () => {
        const record = { id: 'aircraft', documents, operatorPermitNumber: 'PRIVATE', reviewNote: 'PRIVATE', operatorName: 'Operator', pricePerHour: 50000, currency: 'INR', vehicle: { id: 'vehicle', make: 'Test', model: 'Helicopter', seats: 4, images: [], owner: { email: 'private@example.test' }, licensePlate: 'VT-XXX' } };
        const result = publicAircraft(record);
        expect(result.pricingUnit).toBe('HOUR');
        expect(result.bookingMode).toBe('ENQUIRY');
        expect(JSON.stringify(result)).not.toContain('PRIVATE');
        expect(JSON.stringify(result)).not.toContain('private@example.test');
    });
});
