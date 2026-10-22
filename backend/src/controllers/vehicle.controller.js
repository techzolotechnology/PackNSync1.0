import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import {
    assertFullyVerified,
    assertPolicyAccepted,
    assertVehicleVerified,
} from '../utils/verificationHelpers.js';
import { cloudinary, isCloudinaryConfigured } from '../utils/cloudinary.js';
import { publicFileUrl } from '../utils/publicUrl.js';
import { normalizeVehicleType, isTwoWheelerType } from '../utils/vehicleCategories.js';
import { aircraftInput } from '../utils/aviation.js';

export { normalizeVehicleType, isTwoWheelerType };

// POST /api/vehicles
export const registerVehicle = async (req, res) => {
    await assertFullyVerified(req.user.id);
    await assertPolicyAccepted(req.user.id, 'LISTING_TERMS');

    const { make, model, year, type, licensePlate, seats, fuelType, transmission, images, rcUrl } = req.body;
    const normalizedType = normalizeVehicleType(type);
    const isAircraft = normalizedType === 'HELICOPTER';
    const aircraft = isAircraft ? aircraftInput(req.body.aircraft) : null;
    if (!make?.trim() || !model?.trim() || typeof licensePlate !== 'string' || !licensePlate.trim()) throw new AppError('Make, model and registration number are required.', 400);
    if (!Number.isInteger(Number(year)) || Number(year) < 1900 || Number(year) > new Date().getFullYear() + 1) throw new AppError('Enter a valid manufacturing year.', 400);
    const resolvedSeats = seats === undefined ? (isTwoWheelerType(normalizedType) ? 2 : isAircraft ? 4 : 5) : Number(seats);
    if (!Number.isInteger(resolvedSeats) || resolvedSeats < 1 || resolvedSeats > (isTwoWheelerType(normalizedType) ? 2 : 60) || typeof seats === 'boolean') throw new AppError('Enter a valid seat count for this category.', 400);

    const existing = await prisma.vehicle.findUnique({ where: { licensePlate } });
    if (existing) throw new AppError('A vehicle with this license plate already exists.', 400);

    const vehicle = await prisma.vehicle.create({
        data: {
            ownerId: req.user.id,
            make,
            model,
            year: Number(year),
            type: normalizedType,
            licensePlate,
            seats: resolvedSeats,
            fuelType: isAircraft ? 'Aviation fuel' : fuelType,
            transmission: isAircraft ? 'Operator flown' : transmission,
            images: images || [],
            rcUrl,
            ...(aircraft ? { aircraftHosting: { create: aircraft } } : {}),
        },
    });

    res.status(201).json({ success: true, data: vehicle });
};

// GET /api/vehicles/my
export const getMyVehicles = async (req, res) => {
    const vehicles = await prisma.vehicle.findMany({
        where: { ownerId: req.user.id },
        include: {
            aircraftHosting: true,
            _count: { select: { listings: true } },
            listings: {
                where: { isActive: true },
                select: {
                    id: true,
                    pricePerDay: true,
                    location: true,
                    isActive: true,
                    bookings: {
                        where: {
                            status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
                            endDate: { gte: new Date() },
                        },
                        select: { id: true, status: true },
                        take: 1,
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: vehicles });
};

// GET /api/vehicles/:id
export const getVehicleById = async (req, res) => {
    const vehicle = await prisma.vehicle.findUnique({
        where: { id: req.params.id },
        include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
    });
    if (!vehicle) throw new AppError('Vehicle not found.', 404);
    res.json({ success: true, data: vehicle });
};

// PUT /api/vehicles/:id
export const updateVehicle = async (req, res) => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) throw new AppError('Vehicle not found.', 404);
    if (vehicle.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('Only the owner can update this vehicle.', 403);
    }

    // Whitelist: never let the request body set ownerId, isVerified, rcUrl, or timestamps.
    const data = {};
    const { make, model, year, type, seats, fuelType, transmission, images } = req.body;
    if (make !== undefined) data.make = String(make).slice(0, 60);
    if (model !== undefined) data.model = String(model).slice(0, 60);
    if (year !== undefined) {
        const y = Number(year);
        if (!Number.isFinite(y) || y < 1900 || y > new Date().getFullYear() + 1) throw new AppError('Enter a valid year.', 400);
        data.year = Math.round(y);
    }
    if (type !== undefined) {
        const nextType = normalizeVehicleType(type);
        if (nextType !== vehicle.type) throw new AppError('Category cannot be changed after registration. Add a new vehicle in the correct category.', 400);
    }
    if (vehicle.type === 'HELICOPTER') throw new AppError('Use charter setup to edit an aircraft and its operator details.', 400);
    if (seats !== undefined) {
        const s = Number(seats);
        if (!Number.isFinite(s) || s < 1 || s > 60) throw new AppError('Enter a valid seat count.', 400);
        data.seats = Math.round(s);
    }
    if (fuelType !== undefined) data.fuelType = String(fuelType).slice(0, 30);
    if (transmission !== undefined) data.transmission = String(transmission).slice(0, 30);
    if (images !== undefined) data.images = Array.isArray(images) ? images.slice(0, 10).map((u) => String(u).slice(0, 500)) : [];

    const updated = await prisma.vehicle.update({
        where: { id: req.params.id },
        data,
    });
    res.json({ success: true, data: updated });
};

// POST /api/vehicles/upload-image
export const uploadVehicleImage = async (req, res) => {
    if (!req.file) throw new AppError('Image file is required.', 400);

    let url = publicFileUrl(req, `/uploads/vehicles/${req.file.filename}`);
    if (isCloudinaryConfigured()) {
        try {
            const uploaded = await cloudinary.uploader.upload(req.file.path, {
                folder: 'packandsync/vehicles',
                resource_type: 'image',
            });
            url = uploaded.secure_url;
        } catch (err) {
            console.warn('[Vehicle upload] Cloudinary failed, using local file:', err.message);
        }
    }

    res.json({ success: true, data: { url } });
};

// DELETE /api/vehicles/:id
export const deleteVehicle = async (req, res) => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) throw new AppError('Vehicle not found.', 404);
    if (vehicle.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('Only the owner can delete this vehicle.', 403);
    }

    if (vehicle.type === 'HELICOPTER' && await prisma.charterInquiry.count({ where: { aircraft: { vehicleId: vehicle.id } } })) throw new AppError('This aircraft has charter enquiry history. Pause its charter listing instead of deleting it.', 409);
    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Vehicle deleted.' });
};
