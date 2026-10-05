-- Market fields for international expansion; existing listings are Indian.
ALTER TABLE "rental_listings" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'IN';
ALTER TABLE "rental_listings" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';
CREATE INDEX IF NOT EXISTS "rental_listings_country_isActive_idx" ON "rental_listings"("country", "isActive");
