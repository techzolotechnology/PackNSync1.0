import { prisma } from './prisma.js';
import { AppError } from './AppError.js';

export const POLICY_VERSIONS = {
    RIDE_TERMS: '1.0',
    RENTAL_TERMS: '1.0',
    LISTING_TERMS: '1.0',
};

const REQUIRED_KYC = ['DL', 'AADHAAR'];

export const latestVerificationsByType = (verifications = []) => {
    const latestByType = {};
    for (const record of verifications) {
        const existing = latestByType[record.documentType];
        if (!existing || record.createdAt > existing.createdAt) {
            latestByType[record.documentType] = record;
        }
    }
    return latestByType;
};

export const buildVerificationState = (verifications = [], policies = []) => {
    const latestByType = latestVerificationsByType(verifications);
    const isFullyVerified = REQUIRED_KYC.every((type) => latestByType[type]?.status === 'VERIFIED');
    // Only true when a KYC doc was submitted and is waiting on admin — not when missing
    const hasPendingKyc = REQUIRED_KYC.some((type) => latestByType[type]?.status === 'PENDING');
    const hasMissingKyc = REQUIRED_KYC.some((type) => !latestByType[type]);
    const hasRejectedKyc = REQUIRED_KYC.some((type) => latestByType[type]?.status === 'REJECTED');
    const policiesAccepted = {};
    for (const policy of policies) {
        policiesAccepted[policy.policyType] = policy;
    }

    return {
        verifications: Object.values(latestByType),
        latestByType,
        isFullyVerified,
        hasPendingKyc,
        hasMissingKyc,
        hasRejectedKyc,
        policiesAccepted,
        policies,
    };
};

export const getUserVerificationState = async (userId) => {
    const [verifications, policies] = await Promise.all([
        prisma.verification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        prisma.policyAcceptance.findMany({ where: { userId }, orderBy: { acceptedAt: 'desc' } }),
    ]);
    return buildVerificationState(verifications, policies);
};

export const hasAcceptedPolicy = (policies, policyType) => {
    const version = POLICY_VERSIONS[policyType];
    return policies.some((p) => p.policyType === policyType && p.policyVersion === version);
};

export const assertFullyVerified = async (userId) => {
    const state = await getUserVerificationState(userId);
    if (!state.isFullyVerified) {
        throw new AppError('Identity verification required. Complete KYC at /verify and wait for admin approval.', 403);
    }
    return state;
};

export const assertPolicyAccepted = async (userId, policyType) => {
    const version = POLICY_VERSIONS[policyType];
    if (!version) throw new AppError('Unknown policy type.', 400);

    const existing = await prisma.policyAcceptance.findFirst({
        where: { userId, policyType, policyVersion: version },
    });
    if (!existing) {
        throw new AppError(`You must accept ${policyType.replace('_', ' ').toLowerCase()} before continuing.`, 403);
    }
    return existing;
};

export const assertVehicleVerified = async (vehicle) => {
    if (!vehicle.isVerified) {
        throw new AppError(
            vehicle.rcUrl
                ? 'Vehicle RC is waiting for admin approval before you can list.'
                : 'Upload a clear RC photo for this vehicle before listing.',
            403,
        );
    }
};
