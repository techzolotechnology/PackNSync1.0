-- Referral programme
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referredById" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_referralCode_key" ON "users"("referralCode");
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_referredById_fkey') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey"
            FOREIGN KEY ("referredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Promotional wallet credit (spendable, not withdrawable)
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "promoBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Private trip invite links
CREATE TABLE IF NOT EXISTS "trip_invites" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trip_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "trip_invites_tripId_key" ON "trip_invites"("tripId");
CREATE UNIQUE INDEX IF NOT EXISTS "trip_invites_code_key" ON "trip_invites"("code");
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_invites_tripId_fkey') THEN
        ALTER TABLE "trip_invites" ADD CONSTRAINT "trip_invites_tripId_fkey"
            FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
