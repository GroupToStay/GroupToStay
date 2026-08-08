-- Normalized, read-only RLS policy inventory for Production/candidate comparison.
WITH normalized AS (
  SELECT
    p.schemaname::text AS schema,
    p.tablename::text AS "table",
    p.policyname::text AS policy,
    lower(p.cmd)::text AS command,
    lower(p.permissive)::text AS mode,
    to_jsonb(ARRAY(
      SELECT role_name::text
      FROM unnest(p.roles) AS role_name
      ORDER BY role_name::text
    )) AS roles,
    nullif(regexp_replace(btrim(coalesce(p.qual, '')), '[[:space:]]+', ' ', 'g'), '') AS using_expression,
    nullif(regexp_replace(btrim(coalesce(p.with_check, '')), '[[:space:]]+', ' ', 'g'), '') AS with_check_expression,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
  FROM pg_policies p
  JOIN pg_namespace n ON n.nspname = p.schemaname
  JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = p.tablename
  WHERE p.schemaname IN ('public', 'storage')
  ORDER BY p.schemaname, p.tablename, p.policyname, p.cmd
)
SELECT jsonb_build_object(
  'schemaVersion', 1,
  'accessMode', 'isolated_local_catalog_query',
  'policyCount', count(*),
  'policies', coalesce(
    jsonb_agg(to_jsonb(normalized) ORDER BY schema, "table", policy, command),
    '[]'::jsonb
  )
)::text
FROM normalized;
