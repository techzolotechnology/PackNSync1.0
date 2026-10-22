import { describe, expect, it } from 'vitest';
import { aircraftVisibility, hostAmount, money, schedule, validRange, vehiclePayload } from './model';

describe('host business rules', () => {
  it('never counts the platform fee as host income or subtracts a funded offer twice', () => {
    expect(hostAmount({ hostAmount: 6000, platformFee: 120, discountAmount: 100, totalPrice: 6020 })).toBe(6000);
    expect(hostAmount({ platformFee: 120, totalPrice: 6120 })).toBe(6000);
    expect(hostAmount({ hostAmount: 0, totalPrice: 600 })).toBe(0);
  });
  it('excludes unpaid requests from the handover schedule', () => {
    const base = { startDate: '2030-01-20T12:00:00Z', endDate: '2030-01-22T12:00:00Z' };
    const result = schedule([{ ...base, id: 'pending', status: 'PENDING' }, { ...base, id: 'accepted', status: 'CONFIRMED' }, { ...base, id: 'paid', status: 'PAID' }], new Date('2030-01-19'));
    expect(result.map((e) => [e.kind, e.booking.id])).toEqual([['Pickup', 'paid'], ['Return', 'paid']]);
  });
  it('keeps an upcoming return visible after its pickup date has passed', () => {
    expect(schedule([{ status: 'PAID', startDate: '2030-01-20', endDate: '2030-01-25' }], new Date('2030-01-23')).map((e) => e.kind)).toEqual(['Return']);
  });
  it('rejects impossible or reversed calendar dates', () => {
    expect(validRange('2030-02-30', '2030-03-10')).toBe(false);
    expect(validRange('2030-03-10', '2030-03-10')).toBe(false);
    expect(validRange('2030-02-20', '2030-03-10')).toBe(true);
  });
  it('does not show a failed balance request as zero money', () => {
    expect(money(undefined)).toBe('—');
    expect(money(null)).toBe('—');
    expect(money(0)).toContain('0');
  });
  it('only sends vehicle fields supported by the server, without claiming verification', () => {
    const payload = vehiclePayload({ make: ' Hyundai ', model: 'i20', licensePlate: 'ka01ab1234', year: '2024', seats: '5', fuelType: 'Petrol', transmission: 'Manual', isVerified: true, ownerId: 'other' });
    expect(payload.licensePlate).toBe('KA01AB1234');
    expect(payload).not.toHaveProperty('isVerified');
    expect(payload).not.toHaveProperty('ownerId');
    expect(() => vehiclePayload({ ...payload, seats: '-1' })).toThrow();
  });
  it.each(['CAR', 'BIKE', 'SCOOTER'])('saves %s without silently converting its category', (type) => {
    const result = vehiclePayload({ make: 'Test', model: 'Model', type, licensePlate: 'TEST123', year: 2024, seats: type === 'CAR' ? 5 : 2, fuelType: 'Petrol', transmission: type === 'SCOOTER' ? 'Automatic' : 'Manual' });
    expect(result.type).toBe(type);
    expect(result).not.toHaveProperty('aircraft');
  });
  it('keeps hourly helicopter operator details separate from daily rental prices', () => {
    const result = vehiclePayload({ make: 'Test', model: 'Helicopter', type: 'HELICOPTER', licensePlate: 'VT-XXX', year: 2024, seats: 4, operatorName: 'Test operator', operatorPermitNumber: 'Test reference', baseAirport: 'Test helipad', pricePerHour: '50000' });
    expect(result.type).toBe('HELICOPTER');
    expect(result.aircraft.pricePerHour).toBe(50000);
    expect(result).not.toHaveProperty('pricePerDay');
    expect(result.transmission).toBe('Operator flown');
    expect(() => vehiclePayload({ ...result, operatorName: '' })).toThrow();
  });
  it('validates capacity for bikes and scooters', () => {
    expect(() => vehiclePayload({ make: 'Test', model: 'Bike', type: 'BIKE', licensePlate: 'TEST123', year: 2024, seats: 5 })).toThrow(/two seats/);
  });
  it('does not label a helicopter as live after its documents expire', () => {
    const documents = Object.fromEntries(['registration', 'operatorPermit', 'airworthiness', 'insurance'].map((key) => [key, { url: '/private.jpg', expiresAt: '2099-12-31' }]));
    expect(aircraftVisibility({ status: 'APPROVED', isPublished: true, documents }).visible).toBe(true);
    const result = aircraftVisibility({ status: 'APPROVED', isPublished: true, documents: { ...documents, insurance: { url: '/private.jpg', expiresAt: '2000-01-01' } } });
    expect(result.visible).toBe(false);
    expect(result.label).toBe('Renew docs');
  });
});
