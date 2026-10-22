-- Audit copy: applied to vmqrzndlelhjxnekwuar on 2026-10-22.
-- Do not rerun: Prisma history already records this migration.
BEGIN;
SET LOCAL search_path = public;
SET LOCAL lock_timeout = '10s';
-- Expo push token for a user's device (one row per device install).
CREATE TABLE IF NOT EXISTS "push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX IF NOT EXISTS "push_tokens_userId_idx" ON "push_tokens"("userId");

ALTER TABLE "push_tokens"
    ADD CONSTRAINT "push_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_tokens FROM anon, authenticated;
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
VALUES (gen_random_uuid()::text, 'b32a3d0d5a2194703b0980a940734c84b9ae5866f3496e701003fdefba25fa76', now(), '20261011120000_push_tokens', 1);
COMMIT;
