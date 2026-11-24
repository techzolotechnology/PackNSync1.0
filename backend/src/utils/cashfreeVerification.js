const API_VERSION = process.env.CASHFREE_VERIFICATION_API_VERSION || '2023-12-18';

const clean = (value) => String(value || '').trim().replace(/^['"]|['"]$/g, '');

export function cashfreeVerificationConfigured() {
    return Boolean(clean(process.env.CASHFREE_VERIFICATION_CLIENT_ID)
        && clean(process.env.CASHFREE_VERIFICATION_CLIENT_SECRET));
}

function baseUrl() {
    const env = clean(process.env.CASHFREE_VERIFICATION_ENV || process.env.CASHFREE_ENV).toLowerCase();
    return env === 'production' || env === 'prod'
        ? 'https://api.cashfree.com/verification'
        : 'https://sandbox.cashfree.com/verification';
}

export function isCashfreeRedirectUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && (url.hostname === 'cashfree.com' || url.hostname.endsWith('.cashfree.com'));
    } catch {
        return false;
    }
}

async function request(path, { method = 'GET', body } = {}) {
    if (!cashfreeVerificationConfigured()) {
        const error = new Error('Cashfree Secure ID credentials are not configured.');
        error.status = 503;
        throw error;
    }

    const url = new URL(`${baseUrl()}${path}`);
    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-api-version': API_VERSION,
            'x-client-id': clean(process.env.CASHFREE_VERIFICATION_CLIENT_ID),
            'x-client-secret': clean(process.env.CASHFREE_VERIFICATION_CLIENT_SECRET),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload.message || payload.error?.message || 'Cashfree Secure ID request failed.');
        error.status = response.status;
        throw error;
    }
    return payload;
}

export function createCashfreeDigiLockerUrl({ verificationId, redirectUrl }) {
    return request('/digilocker', {
        method: 'POST',
        body: {
            verification_id: verificationId,
            document_requested: ['AADHAAR'],
            redirect_url: redirectUrl,
        },
    });
}

export function fetchCashfreeDigiLockerStatus(verificationId) {
    const query = new URLSearchParams({ verification_id: verificationId });
    return request(`/digilocker?${query}`);
}

export function verifyCashfreeDrivingLicense({ verificationId, licenseNumber, dateOfBirth }) {
    return request('/driving-license', {
        method: 'POST',
        body: {
            verification_id: verificationId,
            dl_number: licenseNumber,
            dob: dateOfBirth,
        },
    });
}
