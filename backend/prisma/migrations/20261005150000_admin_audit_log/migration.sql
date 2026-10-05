-- Admin audit trail
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId");
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_adminId_fkey') THEN
        ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey"
            FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Keep the document link when rejecting; store the reason separately
ALTER TABLE "verifications" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
