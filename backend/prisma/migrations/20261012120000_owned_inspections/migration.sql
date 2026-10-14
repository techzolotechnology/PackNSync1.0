CREATE TABLE "rental_inspections" (
  "id" TEXT NOT NULL, "bookingId" TEXT NOT NULL, "vehicleId" TEXT NOT NULL,
  "checkin" JSONB, "checkout" JSONB, "comparison" JSONB,
  "confirmations" JSONB NOT NULL DEFAULT '{}', "reviewStatus" TEXT NOT NULL DEFAULT 'AWAITING_REVIEW',
  "review" JSONB, "reportId" TEXT, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rental_inspections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rental_inspections_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "rental_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "rental_inspections_bookingId_key" ON "rental_inspections"("bookingId");
CREATE INDEX "rental_inspections_reviewStatus_createdAt_idx" ON "rental_inspections"("reviewStatus", "createdAt");
CREATE INDEX "rental_inspections_vehicleId_createdAt_idx" ON "rental_inspections"("vehicleId", "createdAt");
CREATE TABLE "inspection_images" (
  "id" TEXT NOT NULL, "inspectionId" TEXT NOT NULL, "stage" TEXT NOT NULL, "angle" TEXT NOT NULL,
  "sha256" TEXT NOT NULL, "original" BYTEA NOT NULL, "display" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inspection_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inspection_images_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "rental_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "inspection_images_inspectionId_stage_angle_key" ON "inspection_images"("inspectionId", "stage", "angle");
CREATE TABLE "inspection_events" (
  "id" TEXT NOT NULL, "inspectionId" TEXT NOT NULL, "actorId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "data" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inspection_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inspection_events_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "rental_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "inspection_events_inspectionId_createdAt_idx" ON "inspection_events"("inspectionId", "createdAt");
