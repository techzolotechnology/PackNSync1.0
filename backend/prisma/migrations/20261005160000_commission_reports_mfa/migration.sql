-- Host earnings credit type
ALTER TYPE "WalletTxType" ADD VALUE IF NOT EXISTS 'EARNING';

-- Admin two-factor auth
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpLastStep" INTEGER;

-- Commission split on bookings
ALTER TABLE "rental_bookings" ADD COLUMN IF NOT EXISTS "hostAmount" DOUBLE PRECISION;
ALTER TABLE "rental_bookings" ADD COLUMN IF NOT EXISTS "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Host earnings
CREATE TABLE IF NOT EXISTS "host_earnings" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "releaseAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "host_earnings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "host_earnings_bookingId_key" ON "host_earnings"("bookingId");
CREATE INDEX IF NOT EXISTS "host_earnings_status_releaseAt_idx" ON "host_earnings"("status", "releaseAt");
CREATE INDEX IF NOT EXISTS "host_earnings_hostId_status_idx" ON "host_earnings"("hostId", "status");

-- Reports & disputes
CREATE TABLE IF NOT EXISTS "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "targetType" TEXT NOT NULL DEFAULT 'OTHER',
    "targetId" TEXT,
    "bookingId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "assignedAdminId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "reports_status_priority_createdAt_idx" ON "reports"("status", "priority", "createdAt");
CREATE INDEX IF NOT EXISTS "reports_reporterId_createdAt_idx" ON "reports"("reporterId", "createdAt");

CREATE TABLE IF NOT EXISTS "report_messages" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "authorId" TEXT,
    "fromAdmin" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "report_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "report_messages_reportId_createdAt_idx" ON "report_messages"("reportId", "createdAt");

-- Broadcasts
CREATE TABLE IF NOT EXISTS "broadcasts" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "city" TEXT,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'host_earnings_bookingId_fkey') THEN
        ALTER TABLE "host_earnings" ADD CONSTRAINT "host_earnings_bookingId_fkey"
            FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'host_earnings_hostId_fkey') THEN
        ALTER TABLE "host_earnings" ADD CONSTRAINT "host_earnings_hostId_fkey"
            FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_reporterId_fkey') THEN
        ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey"
            FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_assignedAdminId_fkey') THEN
        ALTER TABLE "reports" ADD CONSTRAINT "reports_assignedAdminId_fkey"
            FOREIGN KEY ("assignedAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_bookingId_fkey') THEN
        ALTER TABLE "reports" ADD CONSTRAINT "reports_bookingId_fkey"
            FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_messages_reportId_fkey') THEN
        ALTER TABLE "report_messages" ADD CONSTRAINT "report_messages_reportId_fkey"
            FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_messages_authorId_fkey') THEN
        ALTER TABLE "report_messages" ADD CONSTRAINT "report_messages_authorId_fkey"
            FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'broadcasts_adminId_fkey') THEN
        ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_adminId_fkey"
            FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
