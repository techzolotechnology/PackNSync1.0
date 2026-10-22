// Read-only readiness check. Does not print URLs, passwords, or application rows.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('DATABASE_URL is missing. Set it privately in the service environment.');
    process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
    const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const actual = new Set(tables.map((row) => row.table_name));
    const schema = await fs.readFile(fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)), 'utf8');
    const expected = Array.from(schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm), (match) => match[2].match(/@@map\("([^"]+)"\)/)?.[1] || match[1]);
    const missing = expected.filter((name) => !actual.has(name));
    if (missing.length) throw new Error(`Missing application tables: ${missing.join(', ')}`);
    // Explicitly exercise the column that previously broke email OTP login.
    await prisma.$queryRaw`SELECT "otpAttempts" FROM public.users LIMIT 0`;
    if (!actual.has('_prisma_migrations')) throw new Error('Prisma migration history is missing. Review/baseline the schema before deployment.');
    const failed = await prisma.$queryRaw`SELECT migration_name FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
    if (failed.length) throw new Error(`Unfinished migrations: ${failed.map((row) => row.migration_name).join(', ')}`);
    console.log(`Database reachable; ${expected.length} application tables found; OTP column and migration history checked. No data was changed.`);
} catch (error) {
    // Prisma exception messages can contain connection details. Only controlled
    // messages above or a short error code are safe to print in deployment logs.
    if (error.constructor === Error) console.error(error.message);
    else console.error(`Database check failed (${error.code || 'connection/query error'}). Check credentials, project status, and schema privately.`);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
