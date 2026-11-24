import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const run = promisify(execFile);
const schemaFile = fileURLToPath(new URL('../../prisma/schema.prisma', import.meta.url));

export function markMigrationApplied(migration) {
    return run(process.execPath, [
        require.resolve('prisma'), 'migrate', 'resolve', '--applied', migration, '--schema', schemaFile,
    ], {
        timeout: 30_000,
        windowsHide: true,
        env: { ...process.env, DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL },
    });
}
