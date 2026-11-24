import { readFile } from 'node:fs/promises';
import { markMigrationApplied } from './prismaMigration.js';

const migration = '20261124120000_explore_ai_chat';
const file = new URL(`../../prisma/migrations/${migration}/migration.sql`, import.meta.url);

export async function prepareExploreAiChat(prisma) {
    const needsRegistration = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261124120000::bigint)`;
        const [tables] = await tx.$queryRaw`
            SELECT to_regclass('"ExploreAiChat"') IS NOT NULL AND to_regclass('"ExploreAiUsage"') IS NOT NULL AS ready,
                to_regclass('_prisma_migrations') IS NOT NULL AS history
        `;
        if (!tables.ready) {
            const sql = await readFile(file, 'utf8');
            for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
                await tx.$executeRawUnsafe(statement);
            }
        }
        if (!tables.history) return true;
        const [entry] = await tx.$queryRaw`
            SELECT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = ${migration}
                AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL) AS applied
        `;
        return !entry.applied;
    }, { timeout: 12_000 });
    if (needsRegistration) {
        try {
            await markMigrationApplied(migration);
        } catch (error) {
            if (!String(error.stderr).includes('P3008')) throw error;
        }
    }
}
