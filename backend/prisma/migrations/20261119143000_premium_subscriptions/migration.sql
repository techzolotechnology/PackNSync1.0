CREATE TYPE "PremiumSubscriptionStatus" AS ENUM (
    'PENDING',
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'CANCELLED',
    'EXPIRED'
);

CREATE TYPE "PremiumBillingProvider" AS ENUM ('CASHFREE', 'GOOGLE_PLAY');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PREMIUM_SUBSCRIPTION';

CREATE TABLE "premium_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PremiumBillingProvider" NOT NULL,
    "providerSubscriptionId" TEXT,
    "providerPlanId" TEXT,
    "status" "PremiumSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "trialPriceInr" INTEGER NOT NULL DEFAULT 5,
    "monthlyPriceInr" INTEGER NOT NULL DEFAULT 499,
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStartedAt" TIMESTAMP(3),
    "currentPeriodEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "reminderSentForPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "premium_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "premium_subscriptions_userId_key" ON "premium_subscriptions"("userId");
CREATE UNIQUE INDEX "premium_subscriptions_providerSubscriptionId_key" ON "premium_subscriptions"("providerSubscriptionId");
CREATE INDEX "premium_subscriptions_status_trialEndsAt_idx" ON "premium_subscriptions"("status", "trialEndsAt");
CREATE INDEX "premium_subscriptions_status_currentPeriodEndsAt_idx" ON "premium_subscriptions"("status", "currentPeriodEndsAt");

ALTER TABLE "premium_subscriptions"
ADD CONSTRAINT "premium_subscriptions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "premium_subscription_events" (
    "id" TEXT NOT NULL,
    "provider" "PremiumBillingProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "premium_subscription_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "premium_subscription_events_providerEventId_key" ON "premium_subscription_events"("providerEventId");
CREATE INDEX "premium_subscription_events_subscriptionId_idx" ON "premium_subscription_events"("subscriptionId");
