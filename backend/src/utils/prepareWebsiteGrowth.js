import { readFile } from 'node:fs/promises';
import { markMigrationApplied } from './prismaMigration.js';

const migration = '20261123120000_website_growth';
const migrationFile = new URL(`../../prisma/migrations/${migration}/migration.sql`, import.meta.url);

export async function applyWebsiteGrowthSchema(prisma) {
    // Also runs on hosts that start Node directly and skip the Prisma deploy command.
    return prisma.$transaction(async (db) => {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(20261123120000::bigint)`;
        const [existing] = await db.$queryRaw`
            SELECT to_regclass('"WebsiteGrowthDaily"') IS NOT NULL AS ready
        `;
        if (!existing.ready) {
            const sql = await readFile(migrationFile, 'utf8');
            for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
                await db.$executeRawUnsafe(statement);
            }
        }

        const [history] = await db.$queryRaw`
            SELECT to_regclass('_prisma_migrations') IS NOT NULL AS ready
        `;
        if (!history.ready) return false;
        const [applied] = await db.$queryRaw`
            SELECT EXISTS (
                SELECT 1 FROM "_prisma_migrations"
                WHERE "migration_name" = ${migration}
                    AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
            ) AS ready
        `;
        return applied.ready;
    });
}

export async function prepareWebsiteGrowth(prisma) {
    if (await applyWebsiteGrowthSchema(prisma)) return;
    await markMigrationApplied(migration);
}
