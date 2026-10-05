import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { AppError } from '../utils/AppError.js';

export const paymentRouter = Router();

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new AppError('Stripe payments are not configured.', 503);
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// POST /api/payments/create-intent
paymentRouter.post('/create-intent', authenticate, async (req, res) => {
    const { amount, currency = 'usd', tripId } = req.body;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > 1000000) {
        throw new AppError('Enter a valid amount.', 400);
    }
    const stripe = getStripe();

    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(value * 100), // in cents
        currency,
        metadata: { userId: req.user.id, tripId: tripId || '' },
    });

    res.json({ success: true, clientSecret: paymentIntent.client_secret });
});

// POST /api/payments/webhook — Stripe webhook
paymentRouter.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const stripe = getStripe();
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
        const intent = event.data.object;
        // upsert: Stripe retries webhooks, and a duplicate insert would 409 forever.
        await prisma.payment.upsert({
            where: { stripePaymentId: intent.id },
            update: {},
            create: {
                userId: intent.metadata.userId,
                tripId: intent.metadata.tripId || null,
                stripePaymentId: intent.id,
                amount: intent.amount / 100,
                currency: intent.currency,
                status: 'succeeded',
            },
        });
    }

    res.json({ received: true });
});
