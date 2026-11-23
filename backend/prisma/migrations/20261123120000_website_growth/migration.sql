CREATE TABLE "WebsiteGrowthDaily" (
    "day" DATE NOT NULL,
    "event" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "landing" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "vehicle" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WebsiteGrowthDaily_pkey" PRIMARY KEY ("day", "event", "source", "landing", "market", "vehicle")
);

ALTER TABLE "WebsiteGrowthDaily" ENABLE ROW LEVEL SECURITY;
