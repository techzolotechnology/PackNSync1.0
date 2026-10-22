// Generates SQL offline; never connects to a database or reads a password.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const migrationsDir = path.join(root, 'backend/prisma/migrations');
const names = (await fs.readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const schema = await fs.readFile(path.join(root, 'backend/prisma/schema.prisma'), 'utf8');
const schemaHash = createHash('sha256').update(schema).digest('hex');
const ddl = execFileSync(process.execPath, [
    path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'diff',
    '--from-empty', '--to-schema-datamodel', 'backend/prisma/schema.prisma', '--script',
], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused', DIRECT_URL: 'postgresql://unused:unused@localhost:5432/unused' },
});
const history = [];
for (const name of names) {
    const bytes = await fs.readFile(path.join(migrationsDir, name, 'migration.sql'));
    const checksum = createHash('sha256').update(bytes).digest('hex');
    history.push(`INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count) VALUES (${quote(name.slice(0, 14))}, ${quote(checksum)}, now(), ${quote(name)}, 1);`);
}
const output = `-- Generated from this checkout's complete Prisma schema; no demo data.
-- Schema SHA256: ${schemaHash}
-- Includes ${names.length} migrations, through ${names.at(-1)}.
-- EMPTY public schema ONLY. Existing tables cause a rollback.
-- For an existing database, inspect it and review migrations instead.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public;
SELECT pg_advisory_xact_lock(72736418);
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S'))
     OR EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'public' AND t.typtype = 'e') THEN
    RAISE EXCEPTION 'Public schema is not empty. Nothing was changed; inspect and migrate existing data instead.';
  END IF;
END
$guard$;

${ddl}

-- Baseline the freshly created schema so Prisma startup does not recreate it.
CREATE TABLE public._prisma_migrations (
  id VARCHAR(36) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  finished_at TIMESTAMPTZ,
  migration_name VARCHAR(255) NOT NULL,
  logs TEXT,
  rolled_back_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count INTEGER NOT NULL DEFAULT 0
);
${history.join('\n')}

-- The existing Express API uses a database owner connection and enforces access.
-- Deny direct Supabase Data API access to these private application tables.
DO $security$
DECLARE item record;
BEGIN
  FOR item IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', item.relname);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', item.relname);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', item.relname);
    END IF;
  END LOOP;
END
$security$;
COMMIT;
`;
await fs.writeFile(path.join(here, 'supabase-fresh-schema.sql'), output);
console.log(`Generated empty-database setup (${names.length} migration baselines). No database was contacted.`);
