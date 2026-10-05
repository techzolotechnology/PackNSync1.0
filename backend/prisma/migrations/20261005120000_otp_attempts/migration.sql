-- Track failed OTP attempts so a code cannot be brute-forced.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otpAttempts" INTEGER NOT NULL DEFAULT 0;

-- Stored codes are now hashed; invalidate any plain-text codes in flight.
UPDATE "users" SET "otpCode" = NULL, "otpExpiresAt" = NULL WHERE "otpCode" IS NOT NULL;
