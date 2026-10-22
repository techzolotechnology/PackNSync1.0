// Integration test: always creates its own local PostgreSQL, never uses production credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const temporary = path.join(root, '.tmp-host-pg');
const { default: EmbeddedPostgres } = await import(pathToFileURL(path.join(temporary, 'node_modules/embedded-postgres/dist/index.js')));
const socket = net.createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const password = randomBytes(18).toString('hex');
const database = new EmbeddedPostgres({
    databaseDir: path.join(temporary, `supabase-test-${randomUUID()}`),
    user: 'postgres', password, port, persistent: true,
    initdbFlags: ['--encoding=UTF8'], onLog: () => {}, onError: () => {},
});
let client;
try {
    await database.initialise();
    await database.start();
    await database.createDatabase('supabase_bootstrap_test');
    const url = `postgresql://postgres:${password}@127.0.0.1:${port}/supabase_bootstrap_test`;
    const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
    const run = (args) => execFileSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), ...args], { cwd: root, env, stdio: 'pipe' });
    client = new PrismaClient({ datasources: { db: { url } } });
    await client.$executeRawUnsafe('CREATE SCHEMA auth');
    await client.$executeRawUnsafe('CREATE TABLE auth.preserved_marker (id INTEGER PRIMARY KEY)');
    await client.$executeRawUnsafe('INSERT INTO auth.preserved_marker VALUES (1)');
    // Simulate Supabase's roles and default public-table grants.
    await client.$executeRawUnsafe('CREATE ROLE anon');
    await client.$executeRawUnsafe('CREATE ROLE authenticated');
    await client.$executeRawUnsafe('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated');
    run(['db', 'execute', '--schema', 'backend/prisma/schema.prisma', '--file', 'database-migration/supabase-fresh-schema.sql']);
    const history = await client.$queryRawUnsafe('SELECT count(*)::int AS count FROM public._prisma_migrations');
    const migrations = (await fs.readdir(path.join(root, 'backend/prisma/migrations'), { withFileTypes: true })).filter((item) => item.isDirectory());
    assert.equal(history[0].count, migrations.length);
    const count = await client.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity");
    assert.equal(count[0].count, 0);
    const privileges = await client.$queryRawUnsafe("SELECT count(*)::int AS count FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon', 'authenticated')");
    assert.equal(privileges[0].count, 0);
    const deployed = run(['migrate', 'deploy', '--schema', 'backend/prisma/schema.prisma']).toString();
    assert.match(deployed, /No pending migrations/);
    run(['migrate', 'diff', '--from-url', url, '--to-schema-datamodel', 'backend/prisma/schema.prisma', '--exit-code']);
    const readiness = execFileSync(process.execPath, ['backend/scripts/check-database.mjs'], { cwd: root, env, stdio: 'pipe' }).toString();
    assert.match(readiness, /Database reachable/);
    assert(!readiness.includes(password));
    await client.$executeRawUnsafe("INSERT INTO public.users (id, name, \"updatedAt\") VALUES ('preserved-user', 'Local test only', now())");
    let refused = false;
    try {
        run(['db', 'execute', '--schema', 'backend/prisma/schema.prisma', '--file', 'database-migration/supabase-fresh-schema.sql']);
    } catch (error) {
        refused = true;
        assert.match(error.stderr.toString(), /Public schema is not empty/);
    }
    assert(refused, 'Repeated bootstrap must refuse to change populated databases.');
    const users = await client.$queryRawUnsafe("SELECT count(*)::int AS count FROM public.users WHERE id='preserved-user'");
    assert.equal(users[0].count, 1);
    const preserved = await client.$queryRawUnsafe('SELECT count(*)::int AS count FROM auth.preserved_marker');
    assert.equal(preserved[0].count, 1);
    // The inspection SQL must run successfully without returning application rows.
    run(['db', 'execute', '--schema', 'backend/prisma/schema.prisma', '--file', 'database-migration/supabase-schema-inspection.sql']);
    console.log(`PASS: fresh schema, ${migrations.length} migration baselines, no Prisma drift, no pending migrations, readiness check, RLS/grants, populated-database refusal, user preservation, auth-schema preservation, inspection SQL.`);
} finally {
    await client?.$disconnect();
    await database.stop();
}
