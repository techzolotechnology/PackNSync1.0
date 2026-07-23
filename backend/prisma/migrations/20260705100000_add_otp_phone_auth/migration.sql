-- OTP auth: add phone + OTP fields, remove password/Google login columns

ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otpCode" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "users_googleId_key";

ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordHash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "googleId";

CREATE UNIQUE INDEX IF NOT EXISTS "users_phoneNumber_key" ON "users"("phoneNumber");
