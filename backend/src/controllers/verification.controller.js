import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { removeVerificationUpload, sanitizeVerificationUpload } from '../middleware/verificationUpload.middleware.js';
import { assertRoadVehicle, ROAD_TYPES } from '../utils/vehicleCategories.js';
import {
    createCashfreeDigiLockerUrl,
    cashfreeVerificationConfigured,
    fetchCashfreeDigiLockerStatus,
    isCashfreeRedirectUrl,
    verifyCashfreeDrivingLicense,
} from '../utils/cashfreeVerification.js';
import { evaluateRcMatch, runRcOcr } from '../utils/rcOcr.js';
import { cloudinary, isCloudinaryConfigured } from '../utils/cloudinary.js';
import {
    POLICY_VERSIONS,
    getUserVerificationState,
} from '../utils/verificationHelpers.js';
import { notifyUser } from '../utils/notify.js';
import { mockDigiLockerDocuments } from '../utils/digilocker.js';

const EMERGENCY_REVIEW_PURPOSE = 'cashfree-emergency-review';

const issueEmergencyReviewToken = (userId, documentType) => jwt.sign(
    { sub: userId, purpose: EMERGENCY_REVIEW_PURPOSE, documentType },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
);

const assertEmergencyReviewToken = (token, userId, documentType) => {
    try {
        const claims = jwt.verify(String(token || ''), process.env.JWT_SECRET);
        if (claims.sub === userId && claims.purpose === EMERGENCY_REVIEW_PURPOSE && claims.documentType === documentType) return;
    } catch {
        // Invalid or expired fallback token.
    }
    throw new AppError('Emergency review is available only after Cashfree is unavailable. Retry Cashfree verification first.', 403);
};

const cashfreeUnavailable = (res, userId, documentType, message) => res.status(503).json({
    success: false,
    message,
    emergencyToken: issueEmergencyReviewToken(userId, documentType),
});

const handleCashfreeFailure = (res, userId, documentType, error) => {
    if (!cashfreeVerificationConfigured()) {
        throw new AppError('Cashfree Secure ID is not configured. Contact PickAndSync support.', 503);
    }
    if (error.status && error.status < 500 && error.status !== 429) {
        throw new AppError('Cashfree rejected this verification request. Check the details or contact PickAndSync support.', 502);
    }
    return cashfreeUnavailable(res, userId, documentType, 'Cashfree identity verification is temporarily unavailable. You can use emergency review for now.');
};

const isValidDateOfBirth = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime())
        && date.toISOString().slice(0, 10) === value
        && date < new Date(new Date().toISOString().slice(0, 10));
};
const assertDigiLockerAvailable = () => {
    if (process.env.DIGILOCKER_MOCK === 'false') {
        throw new AppError('DigiLocker RC verification is not available.', 503);
    }
};

/** OCR text is trivially forgeable, so auto-approval is opt-in. */
const rcOcrAutoApproveEnabled = () => process.env.RC_OCR_AUTO_APPROVE === 'true';

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
        documentNumber: documentNumber ?? null,
        documentUrl: documentUrl ?? null,
        digiLockerId: digiLockerId ?? null,
        status: status || 'PENDING',
        verifiedAt: verifiedAt || null,
        rejectionReason: null,
    };

    if (existing) {
        const updated = await prisma.verification.update({ where: { id: existing.id }, data });
        if (existing.documentUrl?.startsWith('/api/admin/verification-files/') && existing.documentUrl !== updated.documentUrl) {
            removeVerificationUpload(existing.documentUrl);
        }
        return updated;
    }

    return prisma.verification.create({
        data: { userId, documentType, ...data },
    });
};

const markVehicleVerified = async ({ userId, licensePlate, rcUrl, isVerified }) => {
    await prisma.vehicle.updateMany({
        where: { ownerId: userId, licensePlate, type: { in: ROAD_TYPES } },
        data: { rcUrl, isVerified },
    });
};

// POST /api/verifications/submit
export const submitVerification = async (req, res) => {
    const documentType = String(req.body?.documentType || '').toUpperCase();
    if (!['DL', 'AADHAAR'].includes(documentType)) {
        if (req.file) removeVerificationUpload(req.file.filename);
        throw new AppError('Only Aadhaar or Driving License can be sent for emergency review.', 400);
    }
    if (!req.file) throw new AppError('Upload a clear document image for emergency review.', 400);
    try {
        assertEmergencyReviewToken(req.body?.emergencyToken, req.user.id, documentType);
    } catch (error) {
        removeVerificationUpload(req.file.filename);
        throw error;
    }
    await sanitizeVerificationUpload(req.file.path);

    const previous = await prisma.verification.findFirst({
        where: { userId: req.user.id, documentType }, orderBy: { createdAt: 'desc' },
    });
    if (previous?.status === 'VERIFIED') {
        removeVerificationUpload(req.file.filename);
        throw new AppError('This document is already verified.', 409);
    }
    let verification;
    try {
        verification = await upsertVerification({
            userId: req.user.id,
            documentType,
            documentUrl: `/api/admin/verification-files/${req.file.filename}`,
            digiLockerId: 'manual-emergency-review',
            status: 'PENDING',
        });
    } catch (error) {
        removeVerificationUpload(req.file.filename);
        throw error;
    }
    if (previous?.documentUrl && previous.documentUrl !== verification.documentUrl) removeVerificationUpload(previous.documentUrl);
    await notifyUser({
        userId: req.user.id,
        type: 'SYSTEM',
        title: 'Document sent for emergency review',
        body: `Your ${documentType} was sent to our review team because Cashfree verification was unavailable.`,
        data: { verificationId: verification.id, documentType },
    });

    res.status(201).json({
        success: true,
        data: verification,
        message: 'Document submitted for emergency admin review.',
    });
};

// POST /api/verifications/digilocker/connect
export const connectDigiLocker = async (req, res) => {
    const existing = await prisma.verification.findFirst({
        where: { userId: req.user.id, documentType: 'AADHAAR' }, orderBy: { createdAt: 'desc' },
    });
    if (existing?.status === 'VERIFIED') {
        return res.json({ success: true, data: { status: 'VERIFIED' }, message: 'Aadhaar has already been verified by Cashfree.' });
    }

    const verificationId = randomUUID();
    const webReturn = process.env.CASHFREE_VERIFICATION_RETURN_URL || 'https://pickandsync.com/verify';
    let redirectUrl;
    try {
        redirectUrl = new URL(webReturn);
    } catch {
        throw new AppError('Cashfree return URL must be a valid HTTPS URL.', 500);
    }
    if (redirectUrl.protocol !== 'https:' || !(redirectUrl.hostname === 'pickandsync.com' || redirectUrl.hostname.endsWith('.pickandsync.com'))) {
        throw new AppError('Cashfree return URL must use the PickAndSync HTTPS domain.', 500);
    }
    redirectUrl.searchParams.set('cashfreeVerificationId', verificationId);

    let providerResult;
    try {
        providerResult = await createCashfreeDigiLockerUrl({
            verificationId,
            redirectUrl: redirectUrl.toString(),
        });
    } catch (error) {
        console.error('[Cashfree Secure ID] DigiLocker URL creation failed:', error.message);
        return handleCashfreeFailure(res, req.user.id, 'AADHAAR', error);
    }
    if (!isCashfreeRedirectUrl(providerResult.url)) throw new AppError('Cashfree did not return a valid secure verification link. Please try again.', 502);

    await upsertVerification({
        userId: req.user.id,
        documentType: 'AADHAAR',
        digiLockerId: verificationId,
        status: 'PROCESSING',
    });

    res.json({
        success: true,
        data: { verificationId, redirectUrl: providerResult.url },
        message: 'Continue securely with Cashfree and DigiLocker to verify your Aadhaar.',
    });
};

// POST /api/verifications/cashfree/digilocker/status
export const syncCashfreeDigiLockerStatus = async (req, res) => {
    const verificationId = String(req.body?.verificationId || '');
    if (!/^[a-zA-Z0-9._-]{1,50}$/.test(verificationId)) {
        throw new AppError('Invalid Cashfree verification reference.', 400);
    }
    const record = await prisma.verification.findFirst({
        where: { userId: req.user.id, documentType: 'AADHAAR', digiLockerId: verificationId },
    });
    if (!record) throw new AppError('Verification session not found.', 404);
    if (record.status === 'VERIFIED') {
        return res.json({ success: true, data: { status: 'VERIFIED' }, message: 'Aadhaar has already been verified by Cashfree.' });
    }

    let provider;
    try {
        provider = await fetchCashfreeDigiLockerStatus(verificationId);
    } catch (error) {
        console.error('[Cashfree Secure ID] DigiLocker status lookup failed:', error.message);
        return handleCashfreeFailure(res, req.user.id, 'AADHAAR', error);
    }
    const providerStatus = String(provider.status || '').toUpperCase();
    const nextStatus = providerStatus === 'AUTHENTICATED'
        ? 'VERIFIED'
        : ['FAILED', 'FAILURE', 'EXPIRED', 'REJECTED'].includes(providerStatus) ? 'REJECTED' : 'PROCESSING';
    const updated = await prisma.verification.update({
        where: { id: record.id },
        data: {
            status: nextStatus,
            verifiedAt: nextStatus === 'VERIFIED' ? new Date() : null,
            rejectionReason: nextStatus === 'REJECTED' ? 'Cashfree DigiLocker verification was not completed.' : null,
        },
    });
    res.json({
        success: true,
        data: { status: updated.status },
        message: updated.status === 'VERIFIED'
            ? 'Aadhaar verified by Cashfree.'
            : updated.status === 'REJECTED' ? 'Cashfree verification was not completed. Please try again.' : 'Cashfree is still processing your verification.',
    });
};

// POST /api/verifications/cashfree/driving-license
export const verifyDrivingLicenseWithCashfree = async (req, res) => {
    const licenseNumber = String(req.body?.licenseNumber || '').trim().toUpperCase();
    const dateOfBirth = String(req.body?.dateOfBirth || '').trim();
    if (!/^[A-Z0-9-]{8,25}$/.test(licenseNumber)) throw new AppError('Enter a valid driving licence number.', 400);
    if (!isValidDateOfBirth(dateOfBirth)) {
        throw new AppError('Enter your date of birth as shown on your driving licence.', 400);
    }

    const existing = await prisma.verification.findFirst({
        where: { userId: req.user.id, documentType: 'DL' }, orderBy: { createdAt: 'desc' },
    });
    if (existing?.status === 'VERIFIED') {
        return res.json({ success: true, data: { status: 'VERIFIED' }, message: 'Driving licence has already been verified by Cashfree.' });
    }

    const verificationId = randomUUID();
    let result;
    try {
        result = await verifyCashfreeDrivingLicense({ verificationId, licenseNumber, dateOfBirth });
    } catch (error) {
        console.error('[Cashfree Secure ID] Driving licence verification failed:', error.message);
        return handleCashfreeFailure(res, req.user.id, 'DL', error);
    }
    const providerStatus = String(result.status || '').toUpperCase();
    const verified = providerStatus === 'VALID';
    await upsertVerification({
        userId: req.user.id,
        documentType: 'DL',
        // Do not retain the license number or date of birth in our database.
        digiLockerId: `cashfree-dl:${verificationId}`,
        status: verified ? 'VERIFIED' : 'REJECTED',
        verifiedAt: verified ? new Date() : null,
    });

    res.json({
        success: true,
        data: { status: verified ? 'VERIFIED' : 'REJECTED' },
        message: verified ? 'Driving licence verified by Cashfree.' : 'Cashfree could not validate this driving licence. Check the details and try again.',
    });
};

// POST /api/verifications/digilocker/rc
export const submitRcViaDigiLocker = async (req, res) => {
    assertDigiLockerAvailable();
    const { licensePlate } = req.body;
    if (!licensePlate?.trim()) throw new AppError('License plate is required for RC verification.', 400);

    const plate = licensePlate.trim().toUpperCase();
    const vehicle = await prisma.vehicle.findFirst({
        where: { ownerId: req.user.id, licensePlate: plate },
    });
    if (!vehicle) throw new AppError('Add this vehicle to your fleet before submitting RC.', 404);
    assertRoadVehicle(vehicle);

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
    assertRoadVehicle(vehicle);

    // Served only to admins (see GET /api/admin/rc-files/:filename).
    let documentUrl = `/api/admin/rc-files/${req.file.filename}`;
    if (isCloudinaryConfigured()) {
        try {
            const uploaded = await cloudinary.uploader.upload(req.file.path, {
                folder: 'packandsync/rc',
                resource_type: 'image',
                // Not reachable by public URL; fetch with a signed URL.
                type: 'authenticated',
            });
            documentUrl = uploaded.secure_url;
        } catch (err) {
            console.warn('[RC OCR] Cloudinary upload failed, using local file:', err.message);
        }
    }

    const { text, confidence } = await runRcOcr(req.file.path);
    const match = evaluateRcMatch({
        ocrText: text,
        vehicle,
        ownerName: req.user.name,
    });
    const evaluation = rcOcrAutoApproveEnabled() || !match.autoApproved
        ? match
        : {
            ...match,
            autoApproved: false,
            summary: 'RC uploaded and OCR matched. Sent for admin review.',
        };

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
