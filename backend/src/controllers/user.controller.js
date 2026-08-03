import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { cloudinary, isCloudinaryConfigured } from '../utils/cloudinary.js';
import { publicFileUrl } from '../utils/publicUrl.js';
import { getUserVerificationState } from '../utils/verificationHelpers.js';

const PROFILE_SELECT = {
    id: true,
    name: true,
    email: true,
    phoneNumber: true,
    avatarUrl: true,
    bio: true,
    city: true,
    languages: true,
    interests: true,
    emergencyContact: true,
    drivingYears: true,
    travelStyle: true,
    role: true,
    createdAt: true,
};

const parseList = (value) => {
    if (Array.isArray(value)) {
        return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 12);
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
            .slice(0, 12);
    }
    return [];
};

const emptyToNull = (value) => {
    if (value === undefined) return undefined;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
};

// GET /api/users/:id
export const getUserById = async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
            ...PROFILE_SELECT,
            _count: {
                select: {
                    vehicles: true,
                    rentalListings: true,
                    organizedTrips: true,
                    memberships: true,
                },
            },
        },
    });

    if (!user) throw new AppError('User not found.', 404);

    const verification = await getUserVerificationState(user.id);
    const isOwn = req.user?.id === user.id;

    res.json({
        success: true,
        data: {
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            city: user.city,
            languages: user.languages || [],
            interests: user.interests || [],
            travelStyle: user.travelStyle,
            drivingYears: user.drivingYears,
            role: user.role,
            createdAt: user.createdAt,
            email: isOwn ? user.email : undefined,
            phoneNumber: isOwn ? user.phoneNumber : undefined,
            emergencyContact: isOwn ? user.emergencyContact : undefined,
            isVerified: verification.isFullyVerified,
            stats: {
                trips: user._count.memberships + user._count.organizedTrips,
                vehicles: user._count.vehicles,
                listings: user._count.rentalListings,
            },
        },
    });
};

// PUT /api/users/:id
export const updateUser = async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('You can only update your own profile.', 403);
    }

    const {
        name,
        bio,
        avatarUrl,
        city,
        languages,
        interests,
        emergencyContact,
        drivingYears,
        travelStyle,
    } = req.body;

    const data = {};
    if (name !== undefined) {
        const trimmed = String(name).trim();
        if (!trimmed) throw new AppError('Name is required.', 400);
        data.name = trimmed.slice(0, 60);
    }
    if (bio !== undefined) data.bio = emptyToNull(bio)?.slice(0, 280) || null;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (city !== undefined) data.city = emptyToNull(city)?.slice(0, 80) || null;
    if (languages !== undefined) data.languages = parseList(languages);
    if (interests !== undefined) data.interests = parseList(interests);
    if (emergencyContact !== undefined) data.emergencyContact = emptyToNull(emergencyContact)?.slice(0, 80) || null;
    if (travelStyle !== undefined) data.travelStyle = emptyToNull(travelStyle)?.slice(0, 40) || null;
    if (drivingYears !== undefined) {
        if (drivingYears === '' || drivingYears === null) {
            data.drivingYears = null;
        } else {
            const years = Number(drivingYears);
            if (!Number.isFinite(years) || years < 0 || years > 70) {
                throw new AppError('Driving experience must be between 0 and 70 years.', 400);
            }
            data.drivingYears = Math.round(years);
        }
    }

    const updated = await prisma.user.update({
        where: { id: req.params.id },
        data,
        select: PROFILE_SELECT,
    });

    res.json({ success: true, data: updated });
};

// POST /api/users/avatar
export const uploadAvatar = async (req, res) => {
    if (!req.file) throw new AppError('Image file is required.', 400);

    let url = publicFileUrl(req, `/uploads/vehicles/${req.file.filename}`);
    if (isCloudinaryConfigured()) {
        try {
            const uploaded = await cloudinary.uploader.upload(req.file.path, {
                folder: 'packandsync/avatars',
                resource_type: 'image',
                transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
            });
            url = uploaded.secure_url;
        } catch (err) {
            console.warn('[Avatar upload] Cloudinary failed, using local file:', err.message);
        }
    }

    const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl: url },
        select: PROFILE_SELECT,
    });

    res.json({ success: true, data: updated });
};

// DELETE /api/users/:id
export const deleteUser = async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('You can only delete your own account.', 403);
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Account deleted.' });
};

// GET /api/users/:id/trips — past & upcoming trips for a user
export const getUserTrips = async (req, res) => {
    const memberships = await prisma.tripMember.findMany({
        where: { userId: req.params.id, status: 'APPROVED' },
        include: {
            trip: {
                include: { organizer: { select: { id: true, name: true, avatarUrl: true } } },
            },
        },
        orderBy: { trip: { startDate: 'asc' } },
    });

    const trips = memberships.map((m) => m.trip);
    res.json({ success: true, data: trips });
};
