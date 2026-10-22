CREATE TABLE "aircraft_hosting" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "operatorPermitNumber" TEXT NOT NULL,
    "baseAirport" TEXT NOT NULL,
    "pricePerHour" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT,
    "documents" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "aircraft_hosting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "aircraft_hosting_vehicleId_key" ON "aircraft_hosting"("vehicleId");
CREATE INDEX "aircraft_hosting_status_isPublished_idx" ON "aircraft_hosting"("status", "isPublished");
ALTER TABLE "aircraft_hosting" ADD CONSTRAINT "aircraft_hosting_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "charter_inquiries" (
    "id" TEXT NOT NULL,
    "aircraftId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "passengers" INTEGER NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "quotedAmount" DOUBLE PRECISION,
    "quoteNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "charter_inquiries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "charter_inquiries_aircraftId_status_idx" ON "charter_inquiries"("aircraftId", "status");
CREATE INDEX "charter_inquiries_requesterId_createdAt_idx" ON "charter_inquiries"("requesterId", "createdAt");
ALTER TABLE "charter_inquiries" ADD CONSTRAINT "charter_inquiries_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "aircraft_hosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "charter_inquiries" ADD CONSTRAINT "charter_inquiries_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
