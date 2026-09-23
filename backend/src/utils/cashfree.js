/**
 * Cashfree Payment Gateway + Payouts helpers (REST).
 * Docs: https://www.cashfree.com/docs/api-reference/payments/previous/v2023-08-01/orders/create
 */

const API_VERSION = process.env.CASHFREE_API_VERSION || '2023-08-01';

function cleanEnv(val) {
    if (!val) return '';
    return String(val).trim().replace(/^["']|["']$/g, '');
}

export function getClientId() {
    return cleanEnv(
        process.env.CASHFREE_CLIENT_ID ||
        process.env.CASHFREE_APP_ID ||
        process.env.CF_CLIENT_ID ||
        process.env.CF_APP_ID ||
        process.env.CASHFREE_PG_APP_ID ||
        process.env.CASHFREE_KEY_ID ||
        process.env.CASHFREE_KEY
    );
}

export function getClientSecret() {
    return cleanEnv(
        process.env.CASHFREE_CLIENT_SECRET ||
        process.env.CASHFREE_SECRET_KEY ||
        process.env.CF_CLIENT_SECRET ||
        process.env.CF_SECRET_KEY ||
        process.env.CASHFREE_PG_SECRET_KEY ||
        process.env.CASHFREE_API_KEY ||
        process.env.CASHFREE_SECRET
    );
}

export function cashfreeConfigured() {
    return Boolean(getClientId() && getClientSecret());
}

export function cashfreeMockEnabled() {
    if (process.env.CASHFREE_MOCK === 'true') return true;
    if (process.env.CASHFREE_MOCK === 'false') return false;
    // Dev convenience: allow mock top-ups / withdrawals when keys are missing
    return process.env.NODE_ENV !== 'production' && !cashfreeConfigured();
}

export function cashfreeMode() {
    const raw = cleanEnv(process.env.CASHFREE_ENV || process.env.CF_ENV).toLowerCase();
    if (raw === 'production' || raw === 'prod') return 'production';
    if (raw === 'sandbox' || raw === 'test') return 'sandbox';
    // If not explicitly set, auto-detect: sandbox keys in Cashfree typically start with TEST
    const id = getClientId().toUpperCase();
    if (id && !id.startsWith('TEST')) {
        return 'production';
    }
    return 'sandbox';
}

function pgBaseUrl() {
    return cashfreeMode() === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
}

function payoutBaseUrl() {
    return cashfreeMode() === 'production'
        ? 'https://api.cashfree.com/payout'
        : 'https://sandbox.cashfree.com/payout';
}

function pgHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-api-version': API_VERSION,
        'x-client-id': getClientId(),
        'x-client-secret': getClientSecret(),
    };
}

async function parseJson(res) {
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { message: text };
    }
    if (!res.ok) {
        const msg = data?.message || data?.error?.message || `Cashfree error (${res.status})`;
        const err = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

export async function createPgOrder({
    orderId,
    amount,
    currency = 'INR',
    customerId,
    customerPhone,
    customerEmail,
    customerName,
    returnUrl,
    notifyUrl,
    orderNote,
}) {
    const body = {
        order_id: orderId,
        order_amount: Number(amount),
        order_currency: currency,
        customer_details: {
            customer_id: String(customerId).slice(0, 50),
            customer_phone: String(customerPhone || '9999999999').replace(/\D/g, '').slice(-10) || '9999999999',
            ...(customerEmail ? { customer_email: customerEmail } : {}),
            ...(customerName ? { customer_name: customerName } : {}),
        },
        order_meta: {
            ...(returnUrl ? { return_url: returnUrl } : {}),
            ...(notifyUrl ? { notify_url: notifyUrl } : {}),
        },
        ...(orderNote ? { order_note: orderNote } : {}),
    };

    const res = await fetch(`${pgBaseUrl()}/orders`, {
        method: 'POST',
        headers: pgHeaders(),
        body: JSON.stringify(body),
    });
    return parseJson(res);
}

export async function getPgOrder(orderId) {
    const res = await fetch(`${pgBaseUrl()}/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
        headers: pgHeaders(),
    });
    return parseJson(res);
}

export function getPayoutClientId() {
    return cleanEnv(
        process.env.CASHFREE_PAYOUT_CLIENT_ID ||
        process.env.CASHFREE_PAYOUT_APP_ID ||
        process.env.CF_PAYOUT_CLIENT_ID ||
        process.env.CF_PAYOUT_APP_ID ||
        getClientId()
    );
}

export function getPayoutClientSecret() {
    return cleanEnv(
        process.env.CASHFREE_PAYOUT_CLIENT_SECRET ||
        process.env.CASHFREE_PAYOUT_SECRET_KEY ||
        process.env.CF_PAYOUT_CLIENT_SECRET ||
        process.env.CF_PAYOUT_SECRET_KEY ||
        getClientSecret()
    );
}

export function payoutsConfigured() {
    return Boolean(
        (process.env.CASHFREE_PAYOUT_CLIENT_ID || process.env.CASHFREE_PAYOUT_APP_ID || getClientId()) &&
        (process.env.CASHFREE_PAYOUT_CLIENT_SECRET || process.env.CASHFREE_PAYOUT_SECRET_KEY || getClientSecret())
    );
}

/** Cashfree Payouts authorize → bearer token */
async function getPayoutToken() {
    const res = await fetch(`${payoutBaseUrl()}/v1/authorize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Id': getPayoutClientId(),
            'X-Client-Secret': getPayoutClientSecret(),
        },
    });
    const data = await parseJson(res);
    const token = data?.data?.token || data?.token;
    if (!token) throw new Error('Cashfree payout authorize failed — no token.');
    return token;
}

/**
 * Request a bank/UPI payout. Shape varies by Cashfree payout product version;
 * this uses the common v1 transferRequest fields.
 */
export async function createPayoutTransfer({
    transferId,
    amount,
    transferMode, // banktransfer | upi
    beneficiaryName,
    bankAccount,
    ifsc,
    vpa,
    remarks,
}) {
    const token = await getPayoutToken();
    const beneficiary = {
        name: beneficiaryName,
        ...(transferMode === 'upi'
            ? { vpa }
            : { bankAccount, ifsc }),
    };

    const body = {
        beneId: undefined,
        amount: String(Number(amount).toFixed(2)),
        transferId,
        transferMode: transferMode === 'upi' ? 'upi' : 'banktransfer',
        remarks: remarks || 'PickAndSync wallet withdrawal',
        beneDetails: {
            beneId: `bene_${transferId}`.slice(0, 50),
            name: beneficiary.name,
            email: process.env.CASHFREE_PAYOUT_CONTACT_EMAIL || 'support@pickandsync.com',
            phone: process.env.CASHFREE_PAYOUT_CONTACT_PHONE || '9999999999',
            address1: 'India',
            ...(transferMode === 'upi'
                ? { vpa: beneficiary.vpa }
                : {
                    bankAccount: beneficiary.bankAccount,
                    ifsc: beneficiary.ifsc,
                }),
        },
    };

    const res = await fetch(`${payoutBaseUrl()}/v1/requestTransfer`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
    return parseJson(res);
}
