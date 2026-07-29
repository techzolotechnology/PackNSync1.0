-- Track last-read timestamp per user per trip chat
CREATE TABLE IF NOT EXISTS "trip_chat_reads" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trip_chat_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trip_chat_reads_tripId_userId_key"
    ON "trip_chat_reads"("tripId", "userId");

ALTER TABLE "trip_chat_reads"
    DROP CONSTRAINT IF EXISTS "trip_chat_reads_tripId_fkey";
ALTER TABLE "trip_chat_reads"
    ADD CONSTRAINT "trip_chat_reads_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trip_chat_reads"
    DROP CONSTRAINT IF EXISTS "trip_chat_reads_userId_fkey";
ALTER TABLE "trip_chat_reads"
    ADD CONSTRAINT "trip_chat_reads_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
