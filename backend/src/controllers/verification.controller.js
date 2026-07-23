import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { mockDigiLockerDocuments } from '../utils/digilocker.js';
import { evaluateRcMatch, runRcOcr } from '../utils/rcOcr.js';
import { cloudinary, isCloudinaryConfigured } from '../utils/cloudinary.js';
import {
    POLICY_VERSIONS,
    getUserVerificationState,
} from '../utils/verificationHelpers.js';

const VALID_DOC_TYPES = ['DL', 'AADHAAR', 'RC'];

const upsertVerification = async ({ userId, documentType, documentNumber, documentUrl, digiLockerId, status, verifiedAt }) => {
    const where = documentType === 'RC' && documentNumber
        ? { userId, documentType, documentNumber }
        : { userId, documentType };

    const existing = await prisma.verification.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
    });

    if (existing && existing.status === 'VERIFIED') {
        return existing;
    }

    const data = {
        documentNumber,
        documentUrl,
        digiLockerId,
        status: status || 'PENDING',
        verifiedAt: verifiedAt || null,
    };

    if (existing) {
        return prisma.verification.update({ where: { id: existing.id }, data });
    }

    return prisma.verification.create({
        data: { userId, documentType, ...data },
    });
};

const markVehicleVerified = async ({ userId, licensePlate, rcUrl, isVerified }) => {
    await prisma.vehicle.updateMany({
        where: { ownerId: userId, licensePlate },
        data: { rcUrl, isVerified },
    });
};

// POST /api/verifications/submit
export const submitVerification = async (req, res) => {
    const { documentType, documentNumber, documentUrl, digiLockerId } = req.body;
    if (!VALID_DOC_TYPES.includes(documentType)) {
        throw new AppError('Invalid document type. Use DL, AADHAAR, or RC.', 400);
    }

    const verification = await upsertVerification({
        userId: req.user.id,
        documentType,
        documentNumber,
        documentUrl,
        digiLockerId,
    });

    res.status(201).json({
        success: true,
        data: verification,
        message: 'Document submitted for admin review.',
    });
};

// POST /api/verifications/digilocker/connect
export const connectDigiLocker = async (req, res) => {
    const docs = mockDigiLockerDocuments({ userId: req.user.id });
    const saved = await Promise.all(docs.map((doc) => upsertVerification({
        userId: req.user.id,
        ...doc,
    })));

    res.json({
        success: true,
        data: saved,
        message: 'DigiLocker documents fetched. Awaiting admin approval.',
    });
};

// POST /api/verifications/digilocker/rc
export const submitRcViaDigiLocker = async (req, res) => {
    const { licensePlate } = req.body;
    if (!licensePlate?.trim()) throw new AppError('License plate is required for RC verification.', 400);

    const plate = licensePlate.trim().toUpperCase();
    const vehicle = await prisma.vehicle.findFirst({
        where: { ownerId: req.user.id, licensePlate: plate },
    });
    if (!vehicle) throw new AppError('Add this vehicle to your fleet before submitting RC.', 404);

    const [rcDoc] = mockDigiLockerDocuments({ userId: req.user.id, includeRc: true, rcNumber: plate });
    const verification = await upsertVerification({
        userId: req.user.id,
        ...rcDoc,
    });

    await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { rcUrl: rcDoc.digiLockerId },
    });

    res.json({
        success: true,
        data: verification,
        message: 'RC submitted via DigiLocker. Admin will verify before you can list this vehicle.',
    });
};

// POST /api/verifications/rc/upload — OCR semi-auto verification
export const uploadRcForOcr = async (req, res) => {
    const { licensePlate } = req.body;
    if (!licensePlate?.trim()) throw new AppError('License plate is required.', 400);
    if (!req.file) throw new AppError('RC image file is required.', 400);

    const plate = licensePlate.trim().toUpperCase();
    const vehicle = await prisma.vehicle.findFirst({
        where: { ownerId: req.user.id, licensePlate: plate },
    });
    if (!vehicle) throw new AppError('Add this vehicle to your fleet before uploading RC.', 404);

    let documentUrl = `/uploads/rc/${req.file.filename}`;
    if (isCloudinaryConfigured()) {
        try {
            const uploaded = await cloudinary.uploader.upload(req.file.path, {
                folder: 'packandsync/rc',
                resource_type: 'image',
            });
            documentUrl = uploaded.secure_url;
        } catch (err) {
            console.warn('[RC OCR] Cloudinary upload failed, using local file:', err.message);
        }
    }

    const { text, confidence } = await runRcOcr(req.file.path);
    const evaluation = evaluateRcMatch({
        ocrText: text,
        vehicle,
        ownerName: req.user.name,
    });

    const verification = await upsertVerification({
        userId: req.user.id,
        documentType: 'RC',
        documentNumber: plate,
        documentUrl,
        digiLockerId: `ocr://${req.file.filename}`,
        status: evaluation.autoApproved ? 'VERIFIED' : 'PENDING',
        verifiedAt: evaluation.autoApproved ? new Date() : null,
    });

    await markVehicleVerified({
        userId: req.user.id,
        licensePlate: plate,
        rcUrl: documentUrl,
        isVerified: evaluation.autoApproved,
    });

    res.status(201).json({
        success: true,
        data: {
            verification,
            ocr: {
                confidence,
                checks: evaluation.checks,
                autoApproved: evaluation.autoApproved,
                preview: text.slice(0, 500),
            },
        },
        message: evaluation.summary,
    });
};

// GET /api/verifications/status
export const getVerificationStatus = async (req, res) => {
    const state = await getUserVerificationState(req.user.id);
    res.json({ success: true, data: state });
};

// GET /api/verifications/policies/status
export const getPolicyStatus = async (req, res) => {
    const policies = await prisma.policyAcceptance.findMany({
        where: { userId: req.user.id },
        orderBy: { acceptedAt: 'desc' },
    });

    const status = Object.fromEntries(
        Object.entries(POLICY_VERSIONS).map(([policyType, version]) => [
            policyType,
            policies.some((p) => p.policyType === policyType && p.policyVersion === version),
        ])
    );

    res.json({ success: true, data: { policies, status, versions: POLICY_VERSIONS } });
};

// POST /api/verifications/policies/accept
export const acceptPolicy = async (req, res) => {
    const { policyType } = req.body;
    const version = POLICY_VERSIONS[policyType];
    if (!version) throw new AppError('Invalid policy type.', 400);

    const existing = await prisma.policyAcceptance.findFirst({
        where: { userId: req.user.id, policyType, policyVersion: version },
    });
    if (existing) {
        return res.json({ success: true, data: existing, message: 'Policy already accepted.' });
    }

    const acceptance = await prisma.policyAcceptance.create({
        data: { userId: req.user.id, policyType, policyVersion: version },
    });

    res.status(201).json({ success: true, data: acceptance });
};
