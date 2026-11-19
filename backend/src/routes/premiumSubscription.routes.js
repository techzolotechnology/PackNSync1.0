import { createHash } from 'crypto';
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { AppError } from '../utils/AppError.js';
import { prisma } from '../utils/prisma.js';
import { getPremiumBannerPricing } from '../utils/premiumBannerPricing.js';
import { premiumAccess } from '../utils/premiumAccess.js';
import { cashfreeMode } from '../utils/cashfree.js';
import {
    cancelCashfreeSubscription,
    cashfreeSubscriptionsConfigured,
    createCashfreePremiumSubscription,
    fetchCashfreeSubscription,
    verifyCashfreeWebhook,
} from '../utils/cashfreeSubscriptions.js';
import { notifyUser } from '../utils/notify.js';

export const premiumSubscriptionRouter = Router();

function subscriptionEnabled() {
    return process.env.PREMIUM_SUBSCRIPTIONS_ENABLED === 'true' && cashfreeSubscriptionsConfigured();
}

async function activateCashfreeTrial(subscription, providerData = {}) {
    const providerStatus = String(providerData.subscription_status || providerData.status || '').toUpperCase();
    if (providerStatus !== 'ACTIVE' || subscription.cancelAtPeriodEnd) return subscription;

    const now = new Date();
    const providerFirstCharge = providerData.subscription_first_charge_time
        ? new Date(providerData.subscription_first_charge_time)
        : null;
    const trialEndsAt = providerFirstCharge && providerFirstCharge > now
        ? providerFirstCharge
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nextStatus = 'TRIALING';
    const updated = await prisma.premiumSubscription.update({
        where: { id: subscription.id },
        data: {
            status: nextStatus,
            trialStartedAt: nextStatus === 'TRIALING' ? (subscription.trialStartedAt || now) : subscription.trialStartedAt,
            trialEndsAt,
            currentPeriodStartedAt: now,
            currentPeriodEndsAt: trialEndsAt,
        },
    });
    if (nextStatus === 'TRIALING' && subscription.status !== 'TRIALING') {
        await notifyUser({
            userId: subscription.userId,
            type: 'PREMIUM_SUBSCRIPTION',
            title: 'Your Premium banner trial is active',
            body: `Your 30-day Premium banner trial is active. It renews at ₹${subscription.monthlyPriceInr.toLocaleString('en-IN')}/month on ${trialEndsAt.toLocaleDateString('en-IN')} unless you cancel.`,
            data: { premium: true, trialEndsAt: trialEndsAt.toISOString() },
        });
    }
    return updated;
}

async function applyCashfreeEvent(subscription, event) {
    const data = event?.data || {};
    const eventType = String(event?.type || event?.event_type || '').toUpperCase();
    const details = data.subscription_details || data;
    const providerStatus = String(details.subscription_status || details.status || '').toUpperCase();
    if (eventType.includes('STATUS') || eventType.includes('AUTH')) {
        if (providerStatus === 'ACTIVE') return activateCashfreeTrial(subscription, details);
        if (['CANCELLED', 'COMPLETED', 'EXPIRED'].includes(providerStatus)) {
            return prisma.premiumSubscription.update({
                where: { id: subscription.id },
                data: {
                    status: providerStatus === 'EXPIRED' || providerStatus === 'COMPLETED' ? 'EXPIRED' : 'CANCELLED',
                    cancelAtPeriodEnd: providerStatus === 'CANCELLED',
                    cancelledAt: providerStatus === 'CANCELLED' ? new Date() : subscription.cancelledAt,
                },
            });
        }
    }
    if (eventType.includes('PAYMENT_FAILED')) {
        const updated = await prisma.premiumSubscription.update({ where: { id: subscription.id }, data: { status: 'PAST_DUE' } });
        await notifyUser({
            userId: subscription.userId,
            type: 'PREMIUM_SUBSCRIPTION',
            title: 'Premium payment needs attention',
            body: 'Your Premium renewal payment did not complete. Review your mandate or payment method to keep the banner active.',
            data: { premium: true },
        });
        return updated;
    }
    if (eventType.includes('PAYMENT_SUCCESS')) {
        const payment = data.payment_details || data;
        if (String(payment.payment_type || '').toUpperCase() === 'CHARGE') {
            const previousEnd = subscription.currentPeriodEndsAt || new Date();
            const nextEnd = new Date(previousEnd);
            nextEnd.setMonth(nextEnd.getMonth() + 1);
            return prisma.premiumSubscription.update({
                where: { id: subscription.id },
                data: {
                    status: subscription.cancelAtPeriodEnd ? 'CANCELLED' : 'ACTIVE',
                    currentPeriodStartedAt: previousEnd,
                    currentPeriodEndsAt: nextEnd,
                },
            });
        }
    }
    return subscription;
}

premiumSubscriptionRouter.get('/me', authenticate, async (req, res) => {
    const [subscription, pricing] = await Promise.all([
        prisma.premiumSubscription.findUnique({ where: { userId: req.user.id } }),
        getPremiumBannerPricing(),
    ]);
    res.json({
        success: true,
        data: {
            ...premiumAccess(subscription),
            subscription: subscription && {
                status: subscription.status,
                provider: subscription.provider,
                monthlyPriceInr: subscription.monthlyPriceInr,
                trialPriceInr: subscription.trialPriceInr,
                trialStartedAt: subscription.trialStartedAt,
                trialEndsAt: subscription.trialEndsAt,
                currentPeriodEndsAt: subscription.currentPeriodEndsAt,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            },
            offer: { ...pricing, enabled: subscriptionEnabled() },
        },
    });
});

// Cashfree posts the browser back to the merchant after mandate checkout.
// Never trust these form fields as proof of payment; the signed webhook and
// authenticated confirmation endpoint fetch the subscription server-side.
premiumSubscriptionRouter.post('/return/cashfree', (req, res) => {
    let appOrigin = String(process.env.FRONTEND_URL || 'https://pickandsync.com').replace(/\/$/, '');
    if (process.env.NODE_ENV === 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(appOrigin)) {
        appOrigin = 'https://pickandsync.com';
    }
    res.redirect(303, `${appOrigin}/premium?cashfree=return`);
});

premiumSubscriptionRouter.post('/checkout/cashfree', authenticate, async (req, res) => {
    if (!subscriptionEnabled()) {
        throw new AppError('Premium subscriptions are not enabled yet.', 503);
    }
    let existing = await prisma.premiumSubscription.findUnique({ where: { userId: req.user.id } });
    if (existing?.status === 'CANCELLED' && existing.trialStartedAt && existing.currentPeriodEndsAt > new Date()) {
        throw new AppError('Your cancellation is scheduled. Premium remains active until the current period ends.', 409);
    }
    if (existing?.status === 'PENDING' && existing.provider === 'CASHFREE' && existing.providerSubscriptionId) {
        const providerData = await fetchCashfreeSubscription(existing.providerSubscriptionId);
        const providerStatus = String(providerData.subscription_status || '').toUpperCase();
        if (providerStatus === 'ACTIVE') {
            await activateCashfreeTrial(existing, providerData);
            throw new AppError('Your Premium trial is already active.', 409);
        }
        if (providerData.subscription_session_id) {
            return res.json({ success: true, data: {
                subscriptionId: existing.providerSubscriptionId,
                planId: existing.providerPlanId,
                subscriptionSessionId: providerData.subscription_session_id,
                environment: cashfreeMode(),
            } });
        }
        existing = await prisma.premiumSubscription.update({
            where: { id: existing.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
    }
    if (existing && !['CANCELLED', 'EXPIRED'].includes(existing.status)) {
        throw new AppError('Your Premium subscription is already active or being set up.', 409);
    }

    const pricing = await getPremiumBannerPricing();
    const trialEndsAt = new Date(Date.now() + pricing.trialDays * 24 * 60 * 60 * 1000);
    const pending = await prisma.premiumSubscription.upsert({
        where: { userId: req.user.id },
        create: {
            userId: req.user.id,
            provider: 'CASHFREE',
            status: 'PENDING',
            trialPriceInr: pricing.trialPrice,
            monthlyPriceInr: pricing.monthlyPrice,
            currentPeriodStartedAt: new Date(),
            currentPeriodEndsAt: trialEndsAt,
        },
        update: {
            provider: 'CASHFREE',
            providerSubscriptionId: null,
            providerPlanId: null,
            status: 'PENDING',
            trialPriceInr: pricing.trialPrice,
            monthlyPriceInr: pricing.monthlyPrice,
            trialStartedAt: null,
            trialEndsAt: null,
            currentPeriodStartedAt: new Date(),
            currentPeriodEndsAt: trialEndsAt,
            cancelAtPeriodEnd: false,
            cancelledAt: null,
            reminderSentForPeriodEnd: null,
        },
    });

    try {
        const session = await createCashfreePremiumSubscription({
            user: req.user,
            monthlyPrice: pricing.monthlyPrice,
            trialEndsAt,
        });
        await prisma.premiumSubscription.update({
            where: { id: pending.id },
            data: {
                providerSubscriptionId: session.subscriptionId,
                providerPlanId: session.planId,
            },
        });
        res.json({ success: true, data: session });
    } catch (error) {
        await prisma.premiumSubscription.delete({ where: { id: pending.id } }).catch(() => {});
        throw new AppError(error.message || 'Could not start Premium checkout.', error.status || 502);
    }
});

premiumSubscriptionRouter.post('/confirm/cashfree', authenticate, async (req, res) => {
    const subscription = await prisma.premiumSubscription.findUnique({ where: { userId: req.user.id } });
    if (!subscription?.providerSubscriptionId || subscription.provider !== 'CASHFREE') {
        throw new AppError('No Cashfree Premium setup was found for this account.', 404);
    }
    const providerData = await fetchCashfreeSubscription(subscription.providerSubscriptionId);
    const updated = await activateCashfreeTrial(subscription, providerData);
    res.json({ success: true, data: { status: updated.status, trialEndsAt: updated.trialEndsAt, currentPeriodEndsAt: updated.currentPeriodEndsAt } });
});

premiumSubscriptionRouter.post('/cancel', authenticate, async (req, res) => {
    const subscription = await prisma.premiumSubscription.findUnique({ where: { userId: req.user.id } });
    if (!subscription || !['TRIALING', 'ACTIVE', 'PAST_DUE', 'PENDING'].includes(subscription.status)) {
        throw new AppError('There is no active Premium subscription to cancel.', 404);
    }
    if (subscription.provider !== 'CASHFREE' || !subscription.providerSubscriptionId) {
        throw new AppError('This subscription must be cancelled in its app store.', 409);
    }
    await cancelCashfreeSubscription(subscription.providerSubscriptionId);
    const updated = await prisma.premiumSubscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: true, cancelledAt: new Date() },
    });
    res.json({ success: true, data: { cancelAtPeriodEnd: updated.cancelAtPeriodEnd, currentPeriodEndsAt: updated.currentPeriodEndsAt } });
});

premiumSubscriptionRouter.post('/webhook/cashfree', async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const signature = req.get('x-webhook-signature');
    const timestamp = req.get('x-webhook-timestamp');
    if (!verifyCashfreeWebhook(rawBody, signature, timestamp)) {
        return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
    }
    let event;
    try { event = JSON.parse(rawBody); } catch { return res.status(400).end(); }
    const data = event.data || {};
    const details = data.subscription_details || data;
    const providerSubscriptionId = String(details.subscription_id || data.subscription_id || '');
    if (!providerSubscriptionId) return res.status(400).end();

    const subscription = await prisma.premiumSubscription.findUnique({ where: { providerSubscriptionId } });
    if (!subscription) return res.status(200).json({ success: true, ignored: true });

    const providerEventId = String(event.event_id || createHash('sha256').update(rawBody).digest('hex'));
    try {
        await prisma.premiumSubscriptionEvent.create({
            data: {
                provider: 'CASHFREE',
                providerEventId,
                subscriptionId: subscription.id,
                eventType: String(event.type || event.event_type || 'UNKNOWN'),
            },
        });
    } catch (error) {
        if (error.code === 'P2002') return res.status(200).json({ success: true, duplicate: true });
        throw error;
    }
    await applyCashfreeEvent(subscription, event);
    res.json({ success: true });
});
