import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import {
    cashfreeConfigured,
    cashfreeMode,
    getClientId,
    getClientSecret,
} from './cashfree.js';

const SUBSCRIPTION_API_VERSION = process.env.CASHFREE_SUBSCRIPTION_API_VERSION || '2025-01-01';

function baseUrl() {
    return cashfreeMode() === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
}

export function cashfreeSubscriptionsConfigured() {
    return cashfreeConfigured();
}

async function callCashfree(path, { method = 'GET', body, idempotencyKey } = {}) {
    if (!cashfreeConfigured()) throw new Error('Cashfree API credentials are not configured.');
    const response = await fetch(`${baseUrl()}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-api-version': SUBSCRIPTION_API_VERSION,
            'x-client-id': getClientId(),
            'x-client-secret': getClientSecret(),
            'Accept': 'application/json',
            ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload.message || payload.error?.message || `Cashfree returned ${response.status}.`);
        error.status = response.status;
        throw error;
    }
    return payload;
}

export async function createCashfreePremiumSubscription({ user, monthlyPrice, trialEndsAt }) {
    const customerPhone = String(user?.phoneNumber || '').replace(/\D/g, '').slice(-10);
    if (!user?.email || customerPhone.length !== 10) {
        const error = new Error('Add an email address and phone number to your account before starting Premium.');
        error.status = 400;
        throw error;
    }
    const planId = `ps-premium-${monthlyPrice}-month`;
    const idempotencyKey = randomUUID();

    try {
        await callCashfree('/plans', {
            method: 'POST',
            idempotencyKey,
            body: {
                plan_id: planId,
                plan_name: `PickAndSync Premium banner ₹${monthlyPrice}/month`,
                plan_type: 'PERIODIC',
                plan_currency: 'INR',
                plan_recurring_amount: monthlyPrice,
                plan_max_amount: monthlyPrice,
                plan_intervals: 1,
                plan_interval_type: 'MONTH',
                plan_note: 'PickAndSync premium banner placement',
            },
        });
    } catch (error) {
        // Plan IDs are deterministic so admin price changes create a new plan.
        // Reuse the plan only when Cashfree confirms the ID already exists.
        const existing = error.status === 409 || error.status === 400
            ? await callCashfree(`/plans/${encodeURIComponent(planId)}`).catch(() => null)
            : null;
        if (!existing) throw error;
    }

    const subscriptionId = `ps_${randomUUID().replace(/-/g, '')}`;
    const apiOrigin = String(process.env.API_PUBLIC_URL || 'https://api.pickandsync.com').replace(/\/$/, '');
    const response = await callCashfree('/subscriptions', {
        method: 'POST',
        idempotencyKey: randomUUID(),
        body: {
            subscription_id: subscriptionId,
            customer_details: {
                customer_name: user.name,
                customer_email: user.email,
                customer_phone: customerPhone,
            },
            plan_details: { plan_id: planId },
            authorization_details: {
                authorization_amount: 5,
                authorization_amount_refund: false,
                payment_methods: ['upi', 'card', 'enach'],
            },
            subscription_first_charge_time: trialEndsAt.toISOString(),
            subscription_meta: {
                return_url: `${apiOrigin}/api/premium-subscriptions/return/cashfree`,
                notification_channel: ['EMAIL', 'SMS'],
            },
            subscription_tags: { user_id: user.id, offer: 'premium-banner-trial-30d' },
        },
    });

    return {
        subscriptionId,
        planId,
        subscriptionSessionId: response.subscription_session_id,
        status: response.subscription_status,
        environment: cashfreeMode(),
    };
}

export async function fetchCashfreeSubscription(providerSubscriptionId) {
    return callCashfree(`/subscriptions/${encodeURIComponent(providerSubscriptionId)}`);
}

export async function cancelCashfreeSubscription(providerSubscriptionId) {
    return callCashfree(`/subscriptions/${encodeURIComponent(providerSubscriptionId)}/manage`, {
        method: 'POST',
        body: { subscription_id: providerSubscriptionId, action: 'CANCEL' },
        idempotencyKey: randomUUID(),
    });
}

export function verifyCashfreeWebhook(
    rawBody,
    signature,
    timestamp,
    secret = process.env.CASHFREE_PREMIUM_WEBHOOK_SECRET || getClientSecret(),
) {
    if (!rawBody || !signature || !timestamp || !secret) return false;
    const expected = createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('base64');
    const actualBuffer = Buffer.from(String(signature));
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
