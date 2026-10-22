import { AppError } from './AppError.js';

export const VEHICLE_TYPES = ['CAR', 'BIKE', 'SCOOTER', 'HELICOPTER'];
export const ROAD_TYPES = ['CAR', 'BIKE', 'SCOOTER'];
export function normalizeVehicleType(raw) {
    const type = String(raw || 'CAR').trim().toUpperCase();
    if (['TWO_WHEELER', 'MOTORCYCLE'].includes(type)) return 'BIKE';
    if (['CNG_CAR', 'CNG'].includes(type)) return 'CAR';
    if (!VEHICLE_TYPES.includes(type)) throw new AppError('Choose car, bike, scooter or helicopter.', 400);
    return type;
}
export const isTwoWheelerType = (type) => ['BIKE', 'SCOOTER'].includes(normalizeVehicleType(type));
export function assertRoadVehicle(vehicle) {
    if (!ROAD_TYPES.includes(vehicle?.type)) throw new AppError('Helicopters use charter enquiries and operator quotes, not daily self-drive rentals.', 400);
}
