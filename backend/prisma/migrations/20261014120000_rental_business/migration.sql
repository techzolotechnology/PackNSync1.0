CREATE TABLE "rental_business_profiles" (
 "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
 "hostType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
 "businessName" TEXT NOT NULL DEFAULT '', "address" TEXT NOT NULL DEFAULT '',
 "contactNumber" TEXT NOT NULL DEFAULT '', "gstNumber" TEXT NOT NULL DEFAULT '',
 "registrationReference" TEXT NOT NULL DEFAULT '',
 "status" TEXT NOT NULL DEFAULT 'NONE', "reviewNotes" TEXT NOT NULL DEFAULT '',
 "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "rental_business_host_type" CHECK ("hostType" IN ('INDIVIDUAL','RENTAL_SHOP')),
 CONSTRAINT "rental_business_status" CHECK ("status" IN ('NONE','PENDING','APPROVED','REJECTED'))
);
CREATE INDEX "rental_business_profiles_status_idx" ON "rental_business_profiles"("status");
