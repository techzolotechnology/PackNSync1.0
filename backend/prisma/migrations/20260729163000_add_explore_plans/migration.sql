-- AI Explore trip plans
CREATE TYPE "ExplorePlanStatus" AS ENUM ('DRAFT', 'SAVED');

CREATE TABLE "explore_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "pace" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "travelerType" TEXT NOT NULL,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "summary" TEXT,
    "status" "ExplorePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "explore_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "explore_plan_days" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "theme" TEXT,
    "summary" TEXT,
    CONSTRAINT "explore_plan_days_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "explore_plan_stops" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "startTime" TEXT,
    "endTime" TEXT,
    "category" TEXT,
    "reason" TEXT,
    "energy" TEXT,
    "notes" TEXT,
    CONSTRAINT "explore_plan_stops_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "explore_plans_userId_updatedAt_idx" ON "explore_plans"("userId", "updatedAt");
CREATE UNIQUE INDEX "explore_plan_days_planId_dayNumber_key" ON "explore_plan_days"("planId", "dayNumber");
CREATE INDEX "explore_plan_stops_dayId_sortOrder_idx" ON "explore_plan_stops"("dayId", "sortOrder");

ALTER TABLE "explore_plans"
    ADD CONSTRAINT "explore_plans_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "explore_plan_days"
    ADD CONSTRAINT "explore_plan_days_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "explore_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "explore_plan_stops"
    ADD CONSTRAINT "explore_plan_stops_dayId_fkey"
    FOREIGN KEY ("dayId") REFERENCES "explore_plan_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
