-- Promo credit that expires unused is removed with an EXPIRE wallet transaction
ALTER TYPE "WalletTxType" ADD VALUE IF NOT EXISTS 'EXPIRE';

-- Offer discount taken off a booking at payment (PickAndSync bears it)
ALTER TABLE "rental_bookings" ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Blocks of promo credit, each with an optional expiry
CREATE TABLE IF NOT EXISTS "promo_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remaining" DOUBLE PRECISION NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "note" TEXT,
    "offerId" TEXT,
    "grantedById" TEXT,
    "referenceId" TEXT NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promo_grants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "promo_grants_referenceId_key" ON "promo_grants"("referenceId");
CREATE INDEX IF NOT EXISTS "promo_grants_userId_remaining_idx" ON "promo_grants"("userId", "remaining");
CREATE INDEX IF NOT EXISTS "promo_grants_expiresAt_idx" ON "promo_grants"("expiresAt");

-- Admin offers: rental discounts and wallet credits
CREATE TABLE IF NOT EXISTS "offers" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "creditAmount" DOUBLE PRECISION,
    "creditExpiresAt" TIMESTAMP(3),
    "discountType" TEXT,
    "discountValue" DOUBLE PRECISION,
    "maxDiscount" DOUBLE PRECISION,
    "minBookingAmount" DOUBLE PRECISION,
    "appliesTo" TEXT NOT NULL DEFAULT 'ALL',
    "usesPerUser" INTEGER NOT NULL DEFAULT 1,
    "validUntil" TIMESTAMP(3),
    "audience" TEXT NOT NULL,
    "city" TEXT,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "offers_status_kind_idx" ON "offers"("status", "kind");

CREATE TABLE IF NOT EXISTS "offer_recipients" (
    "offerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "offer_recipients_pkey" PRIMARY KEY ("offerId","userId")
);
CREATE INDEX IF NOT EXISTS "offer_recipients_userId_idx" ON "offer_recipients"("userId");

CREATE TABLE IF NOT EXISTS "offer_redemptions" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "offer_redemptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "offer_redemptions_bookingId_key" ON "offer_redemptions"("bookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "offer_redemptions_offerId_userId_seq_key" ON "offer_redemptions"("offerId", "userId", "seq");

-- Foreign keys (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promo_grants_userId_fkey') THEN
        ALTER TABLE "promo_grants" ADD CONSTRAINT "promo_grants_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promo_grants_grantedById_fkey') THEN
        ALTER TABLE "promo_grants" ADD CONSTRAINT "promo_grants_grantedById_fkey"
            FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promo_grants_offerId_fkey') THEN
        ALTER TABLE "promo_grants" ADD CONSTRAINT "promo_grants_offerId_fkey"
            FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_createdById_fkey') THEN
        ALTER TABLE "offers" ADD CONSTRAINT "offers_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offer_recipients_offerId_fkey') THEN
        ALTER TABLE "offer_recipients" ADD CONSTRAINT "offer_recipients_offerId_fkey"
            FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offer_recipients_userId_fkey') THEN
        ALTER TABLE "offer_recipients" ADD CONSTRAINT "offer_recipients_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offer_redemptions_offerId_fkey') THEN
        ALTER TABLE "offer_redemptions" ADD CONSTRAINT "offer_redemptions_offerId_fkey"
            FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offer_redemptions_userId_fkey') THEN
        ALTER TABLE "offer_redemptions" ADD CONSTRAINT "offer_redemptions_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offer_redemptions_bookingId_fkey') THEN
        ALTER TABLE "offer_redemptions" ADD CONSTRAINT "offer_redemptions_bookingId_fkey"
            FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Promo credit people already hold becomes a no-expiry grant, so every rupee is tracked
INSERT INTO "promo_grants" ("id", "userId", "amount", "remaining", "source", "note", "referenceId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, w."userId", w."promoBalance", w."promoBalance", 'LEGACY',
       'Credit added before expiry dates existed', 'legacy_' || w."id", now(), now()
FROM "wallets" w
WHERE w."promoBalance" > 0
ON CONFLICT ("referenceId") DO NOTHING;
