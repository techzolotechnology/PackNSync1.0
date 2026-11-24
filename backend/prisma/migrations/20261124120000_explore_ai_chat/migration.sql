CREATE TABLE IF NOT EXISTS "ExploreAiChat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "ownerKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "searchQuery" TEXT,
    "searchIntent" JSONB,
    "lease" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "ExploreAiChat_ownerKey_kind_createdAt_idx" ON "ExploreAiChat"("ownerKey", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "ExploreAiChat_updatedAt_idx" ON "ExploreAiChat"("updatedAt");
CREATE TABLE IF NOT EXISTS "ExploreAiUsage" (
    "ownerKey" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("ownerKey", "day")
);
ALTER TABLE "ExploreAiChat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExploreAiUsage" ENABLE ROW LEVEL SECURITY;
