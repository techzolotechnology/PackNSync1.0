import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { notifyUser } from '../utils/notify.js';

// GET /api/admin/verifications
export const listVerifications = async (req, res) => {
    const { status = 'PENDING', page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = status === 'ALL' ? {} : { status: String(status).toUpperCase() };

    const [verifications, total] = await Promise.all([
        prisma.verification.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true, phoneNumber: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit),
        }),
        prisma.verification.count({ where }),
    ]);

    res.json({ success: true, data: verifications, pagination: { page: Number(page), total } });
};

// PUT /api/admin/verifications/:id/approve
export const approveVerification = async (req, res) => {
    const verification = await prisma.verification.findUnique({
        where: { id: req.params.id },
        include: { user: true },
    });
    if (!verification) throw new AppError('Verification not found.', 404);

    const updated = await prisma.verification.update({
        where: { id: verification.id },
        data: { status: 'VERIFIED', verifiedAt: new Date() },
    });

    if (verification.documentType === 'RC' && verification.documentNumber) {
        await prisma.vehicle.updateMany({
            where: {
                ownerId: verification.userId,
                licensePlate: verification.documentNumber,
            },
            data: { isVerified: true },
        });
    }

    await notifyUser({
        userId: verification.userId,
        type: 'REQUEST_APPROVED',
        title: 'Verification approved',
        body: `Your ${verification.documentType} verification was approved. You can use verified features now.`,
        data: { verificationId: verification.id, documentType: verification.documentType },
    });

    res.json({ success: true, data: updated, message: 'Verification approved.' });
};

// PUT /api/admin/verifications/:id/reject
export const rejectVerification = async (req, res) => {
    const { reason } = req.body;
    const verification = await prisma.verification.findUnique({ where: { id: req.params.id } });
    if (!verification) throw new AppError('Verification not found.', 404);

    const updated = await prisma.verification.update({
        where: { id: verification.id },
        data: {
            status: 'REJECTED',
            verifiedAt: null,
            documentUrl: reason ? `REJECTED: ${reason}` : verification.documentUrl,
        },
    });

    if (verification.documentType === 'RC' && verification.documentNumber) {
        await prisma.vehicle.updateMany({
            where: {
                ownerId: verification.userId,
                licensePlate: verification.documentNumber,
            },
            data: { isVerified: false },
        });
    }

    await notifyUser({
        userId: verification.userId,
        type: 'REQUEST_REJECTED',
        title: 'Verification rejected',
        body: reason
            ? `Your ${verification.documentType} was rejected: ${reason}`
            : `Your ${verification.documentType} verification was rejected. Please resubmit.`,
        data: { verificationId: verification.id, documentType: verification.documentType, reason: reason || null },
    });

    res.json({ success: true, data: updated, message: 'Verification rejected.' });
};

// GET /api/admin/vehicles
export const listVehiclesForReview = async (req, res) => {
    const vehicles = await prisma.vehicle.findMany({
        include: {
            owner: { select: { id: true, name: true, email: true, phoneNumber: true } },
            _count: { select: { listings: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.json({ success: true, data: vehicles });
};

// PUT /api/admin/vehicles/:id/verify
export const verifyVehicle = async (req, res) => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) throw new AppError('Vehicle not found.', 404);

    const updated = await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { isVerified: true },
    });

    if (vehicle.licensePlate) {
        const existing = await prisma.verification.findFirst({
            where: { userId: vehicle.ownerId, documentType: 'RC', documentNumber: vehicle.licensePlate },
            orderBy: { createdAt: 'desc' },
        });
        if (existing && existing.status !== 'VERIFIED') {
            await prisma.verification.update({
                where: { id: existing.id },
                data: { status: 'VERIFIED', verifiedAt: new Date() },
            });
        }
    }

    await notifyUser({
        userId: vehicle.ownerId,
        type: 'REQUEST_APPROVED',
        title: 'Vehicle verified',
        body: `${vehicle.make} ${vehicle.model} (${vehicle.licensePlate}) is verified. You can list it for rent.`,
        data: { vehicleId: vehicle.id },
    });

    res.json({ success: true, data: updated });
};

// PUT /api/admin/vehicles/:id/reject
export const rejectVehicle = async (req, res) => {
    const { reason } = req.body;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) throw new AppError('Vehicle not found.', 404);

    const updated = await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { isVerified: false },
    });

    // Deactivate listings for unverified vehicles
    await prisma.rentalListing.updateMany({
        where: { vehicleId: vehicle.id },
        data: { isActive: false },
    });

    if (vehicle.licensePlate) {
        const existing = await prisma.verification.findFirst({
            where: { userId: vehicle.ownerId, documentType: 'RC', documentNumber: vehicle.licensePlate },
            orderBy: { createdAt: 'desc' },
        });
        if (existing && existing.status !== 'REJECTED') {
            await prisma.verification.update({
                where: { id: existing.id },
                data: {
                    status: 'REJECTED',
                    verifiedAt: null,
                    documentUrl: reason ? `REJECTED: ${reason}` : existing.documentUrl,
                },
            });
        }
    }

    await notifyUser({
        userId: vehicle.ownerId,
        type: 'REQUEST_REJECTED',
        title: 'Vehicle verification rejected',
        body: reason
            ? `${vehicle.make} ${vehicle.model} was rejected: ${reason}`
            : `${vehicle.make} ${vehicle.model} RC was rejected. Listings were deactivated.`,
        data: { vehicleId: vehicle.id, reason: reason || null },
    });

    res.json({ success: true, data: updated, message: 'Vehicle rejected and listings deactivated.' });
};
