-- PickAndSync: read-only schema inspection.
-- Run in Supabase SQL Editor for project vmqrzndlelhjxnekwuar only.
-- No application rows or credentials are returned. No schema/data changes.
BEGIN TRANSACTION READ ONLY;

SELECT jsonb_build_object(
  'database', current_database(),
  'prisma_history_present', to_regclass('public._prisma_migrations') IS NOT NULL,
  'tables', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', c.relname, 'rls_enabled', c.relrowsecurity
    ) ORDER BY c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  ), '[]'::jsonb),
  'columns', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', table_name, 'column', column_name,
      'type', udt_name, 'nullable', is_nullable, 'default', column_default
    ) ORDER BY table_name, ordinal_position)
    FROM information_schema.columns WHERE table_schema = 'public'
  ), '[]'::jsonb),
  'enums', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('name', typname, 'values', labels) ORDER BY typname)
    FROM (
      SELECT t.typname, jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
      FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE n.nspname = 'public' GROUP BY t.typname
    ) AS enums
  ), '[]'::jsonb),
  'constraints', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', c.relname, 'name', k.conname,
      'definition', pg_get_constraintdef(k.oid)
    ) ORDER BY c.relname, k.conname)
    FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  ), '[]'::jsonb),
  'indexes', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', tablename, 'name', indexname, 'definition', indexdef
    ) ORDER BY tablename, indexname)
    FROM pg_indexes WHERE schemaname = 'public'
  ), '[]'::jsonb)
) AS schema_report;

COMMIT;

-- If prisma_history_present is true, run this separately to inspect history:
-- SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
-- FROM public._prisma_migrations ORDER BY started_at;
