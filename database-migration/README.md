# Supabase database cutover

## Current status

These files prepare the database and deployment configuration. They do **not**
mean the live database has been created, migrated, or connected to the API.
Supabase access to the selected project was confirmed on 2026-10-22. Render still
reports that its integration is not connected, so the live API cutover is pending.

Live verification found 16 completed Prisma migrations and existing data. The missing
committed push-token migration was applied, bringing Prisma history to 17 migrations.
Before/after checks both returned 8 users, 5 wallets, and 28 wallet transactions;
wallet and promo balance totals were unchanged. Push-token RLS is enabled and direct
`anon`/`authenticated` grants were removed. No fresh-schema reset was run.

The host/aviation migration is not applied to the live database; it must
be coordinated with its corresponding backend code rollout.

Selected destination: `vmqrzndlelhjxnekwuar`.
Supabase session pooler supplied by the owner:
`aws-1-ap-south-1.pooler.supabase.com:5432`, database `postgres`,
username `postgres.vmqrzndlelhjxnekwuar`.

The Render source is expired/suspended. The owner declined an upgrade and has
no backup. A fresh Supabase schema cannot restore historical customers, bookings,
wallet balances, payments, or uploaded files from that source. Existing Supabase
records must be preserved and inspected separately. Do not invent or seed balances.

## Choose the correct schema path

### Existing Supabase tables: preserve them

1. Open the selected project in Supabase SQL Editor.
2. Run `supabase-schema-inspection.sql`. It only reports metadata.
3. If the result says Prisma history exists, also run the commented migration
   history query at the end of that file.
4. Compare that history AND the actual columns/indexes against this checkout.
   Some old migrations remove password/Google-login columns and change roles;
   they need review before applying to populated databases.
5. Do not use `migrate reset`, `db push --accept-data-loss`, or mark migrations
   applied without checking that their schema changes already exist.

### Empty Supabase public schema: create the full schema

Run `supabase-fresh-schema.sql` in Supabase SQL Editor. It:

- creates all tables, indexes, enums, and relationships in this checkout;
- records a Prisma baseline for all 18 migrations, so startup will not replay them;
- enables RLS and revokes direct `anon`/`authenticated` access to application tables;
- leaves Supabase's `auth` and `storage` schemas untouched;
- creates no sample users, fake bookings, wallet credits, or admin passwords;
- refuses to run over existing public tables, views, sequences, or enum types;
- rolls back the entire setup if any step fails.

The SQL contains the host/aviation migration
`20261021180000_hosting_categories_charters`, included in this checkout.
Deploy this same reviewed code/schema snapshot together. Regenerate the SQL after
changing any schema or migration file:

```powershell
node database-migration/build-fresh-schema.mjs
```

If the guard says the schema is not empty, use the existing-table path above.
Do not delete existing tables to bypass it. A different fresh project would require
its own exact connection details from Supabase Connect.

## Point the API to Supabase

1. Finish/verify the destination schema first.
2. In the **running API web service** environment settings on Render, replace
   `DATABASE_URL` and `DIRECT_URL` using `supabase.env.example`. Enter the real,
   URL-encoded password privately; never commit it or paste it into chat.
   Confirm the session pooler hostname in Supabase Connect before saving.
3. Keep all existing JWT, Cashfree, email, storage, frontend URL, and other secrets.
   This change moves PostgreSQL only; the API can continue running on Render.
4. For a native Node Render service, use this start command from repository root:

   ```text
   npm run start:production --workspace=backend
   ```

   If the service root is already `backend`, use `npm run start:production`.
   The Docker deployment already runs `prisma migrate deploy` before serving.
5. Save/redeploy. Run `npm run db:check --workspace=backend` in the configured
   service environment to check connectivity, tables, OTP column, and history.
   `npx prisma migrate status --schema=backend/prisma/schema.prisma` checks pending
   migrations using the private environment values.
6. Verify login with a real owner-controlled account, listings, bookings, and wallet
   reads against the new database. `/health` alone does not check the database.
   A fresh schema has no historical users or admin role; use the existing
   `admin:upsert` procedure only for the intended owner's verified account.
7. Confirm Render environment values now point to Supabase. Do not delete Render
   resources before the live destination and API are verified.

`render.yaml` now accepts external database values instead of reading them from
Render Postgres. **That file change alone does not replace existing live environment
variables**; they must be updated in the service settings. The legacy database
resource declaration is retained to avoid unintended Blueprint removal during cutover.

## Local verification performed

The isolated PostgreSQL integration test checks fresh bootstrap, migration checksums
through `migrate deploy`, zero Prisma schema drift, RLS/grants, refusal on rerun,
preservation of a user record and a separate `auth` schema, and the inspection query.
It never uses a supplied/production database URL.

```powershell
node database-migration/test-fresh-schema.mjs
```

That test uses the existing ignored `.tmp-host-pg` embedded PostgreSQL dependency.

Connection references:
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits

Supabase documents session pooling on port 5432 as an IPv4-compatible alternative
for persistent servers. Migration connections must not use transaction mode on 6543.
