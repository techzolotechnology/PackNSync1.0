import 'dotenv/config';
import { reconcileHostRefreshMigration } from '../src/utils/reconcileHostRefreshMigration.js';

await reconcileHostRefreshMigration().catch((error) => {
    console.error('[migrate] Could not reconcile the failed Host refresh migration:', error.code || error.name);
    process.exitCode = 1;
});
