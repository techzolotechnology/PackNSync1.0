-- CreateTable
CREATE TABLE "driver_reviews" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "rentalBookingId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_reviews_rentalBookingId_key" ON "driver_reviews"("rentalBookingId");

-- CreateIndex
CREATE INDEX "driver_reviews_driverId_createdAt_idx" ON "driver_reviews"("driverId", "createdAt");

-- AddForeignKey
ALTER TABLE "driver_reviews" ADD CONSTRAINT "driver_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_reviews" ADD CONSTRAINT "driver_reviews_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_reviews" ADD CONSTRAINT "driver_reviews_rentalBookingId_fkey" FOREIGN KEY ("rentalBookingId") REFERENCES "rental_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
