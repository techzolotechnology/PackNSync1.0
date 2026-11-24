import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { markMigrationApplied } from './prismaMigration.js';

const migration = '20261119160000_host_refresh_token';
const sqlPath = new URL(`../../prisma/migrations/${migration}/migration.sql`, import.meta.url);

export async function completeFailedHostRefreshSchema(prisma) {
    return prisma.$transaction(async (db) => {
        const [history] = await db.$queryRaw`SELECT to_regclass('_prisma_migrations') IS NOT NULL AS ready`;
        if (!history.ready) return false;

        await db.$executeRaw`SELECT pg_advisory_xact_lock(20261119160000::bigint)`;
        const [record] = await db.$queryRaw`
            SELECT
                COUNT(*) FILTER (WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL) > 0 AS failed,
                COUNT(*) FILTER (WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL) > 0 AS applied
            FROM "_prisma_migrations"
            WHERE "migration_name" = ${migration}
        `;
        if (!record.failed || record.applied) return false;

        await db.$executeRaw`SET LOCAL lock_timeout = '4s'`;
        await db.$executeRawUnsafe(await readFile(sqlPath, 'utf8'));
        const [column] = await db.$queryRaw`
            SELECT data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'hostRefreshToken'
        `;
        if (column?.data_type !== 'text' || column.is_nullable !== 'YES' || column.column_default !== null) {
            throw new Error('users.hostRefreshToken differs from the expected nullable text column');
        }
        return true;
    }, { timeout: 10_000 });
}

export async function reconcileHostRefreshMigration() {
    // Check and update the same database that Prisma Migrate uses.
    const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    const prisma = new PrismaClient({ datasourceUrl: directUrl });
    let requiresResolution;
    try {
        requiresResolution = await completeFailedHostRefreshSchema(prisma);
    } finally {
        await prisma.$disconnect();
    }
    if (!requiresResolution) return;

    try {
        await markMigrationApplied(migration);
    } catch (error) {
        // Another deploy may have resolved the same entry after the schema check.
        if (!String(error.stderr).includes('P3008')) throw error;
    }
    console.log(`[migrate] Reconciled ${migration}`);
}
