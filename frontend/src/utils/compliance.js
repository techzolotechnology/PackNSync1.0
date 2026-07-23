import { verificationsApi } from '../api/index.js';

export async function hasAcceptedPolicy(policyType) {
    const res = await verificationsApi.getPolicyStatus();
    return Boolean(res.data.data?.status?.[policyType]);
}

export async function ensurePolicyAccepted(policyType, { onAccepted, onMissing } = {}) {
    const accepted = await hasAcceptedPolicy(policyType);
    if (accepted) return true;
    if (onMissing) return onMissing();
    return false;
}
