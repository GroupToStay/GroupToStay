-- Normalized, read-only grant inventory for Production/candidate comparison.
WITH raw_table_grants AS (
  SELECT
    table_schema::text AS schema,
    table_name::text AS object,
    grantee::text,
    grantor::text,
    lower(privilege_type)::text AS privilege,
    (is_grantable = 'YES') AS grantable
  FROM information_schema.role_table_grants
  WHERE table_schema IN ('public', 'storage')
),
raw_column_grants AS (
  SELECT
    table_schema::text AS schema,
    table_name::text AS object,
    column_name::text AS column_name,
    grantee::text,
    grantor::text,
    lower(privilege_type)::text AS privilege,
    (is_grantable = 'YES') AS grantable
  FROM information_schema.column_privileges
  WHERE table_schema IN ('public', 'storage')
),
raw_routine_grants AS (
  SELECT
    g.routine_schema::text AS schema,
    g.routine_name::text AS routine,
    coalesce(pg_get_function_identity_arguments(p.oid), '')::text AS identity_arguments,
    g.grantee::text,
    g.grantor::text,
    lower(g.privilege_type)::text AS privilege,
    (g.is_grantable = 'YES') AS grantable
  FROM information_schema.role_routine_grants g
  LEFT JOIN pg_namespace n ON n.nspname = g.routine_schema
  LEFT JOIN pg_proc p
    ON p.pronamespace = n.oid
   AND (p.proname || '_' || p.oid::text) = g.specific_name
  WHERE g.routine_schema = 'public'
),
raw_sequence_grants AS (
  SELECT
    n.nspname::text AS schema,
    c.relname::text AS sequence,
    coalesce(grantee_role.rolname, 'PUBLIC')::text AS grantee,
    coalesce(grantor_role.rolname, 'PUBLIC')::text AS grantor,
    lower(a.privilege_type)::text AS privilege,
    a.is_grantable AS grantable
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('S', c.relowner))) a
  LEFT JOIN pg_roles grantee_role ON grantee_role.oid = a.grantee
  LEFT JOIN pg_roles grantor_role ON grantor_role.oid = a.grantor
  WHERE n.nspname IN ('public', 'storage')
    AND c.relkind = 'S'
),
all_grantees AS (
  SELECT grantee FROM raw_table_grants
  UNION SELECT grantee FROM raw_column_grants
  UNION SELECT grantee FROM raw_routine_grants
  UNION SELECT grantee FROM raw_sequence_grants
),
role_classification AS (
  SELECT
    grantee,
    CASE
      WHEN grantee IN ('anon', 'authenticated', 'service_role') THEN 'application-semantic'
      WHEN grantee = 'PUBLIC'
        OR grantee = 'postgres'
        OR grantee = 'authenticator'
        OR grantee = 'dashboard_user'
        OR grantee = 'pgbouncer'
        OR grantee LIKE 'supabase_%' THEN 'supabase-managed'
      WHEN grantee LIKE 'pg_%'
        OR grantee LIKE 'pgsodium_%'
        OR grantee IN ('vault_admin', 'extensions') THEN 'extension-runtime-managed'
      ELSE 'application-other'
    END AS category
  FROM all_grantees
)
SELECT jsonb_build_object(
  'schemaVersion', 1,
  'accessMode', 'isolated_local_catalog_query',
  'roleClassifications', coalesce((
    SELECT jsonb_agg(jsonb_build_object('role', grantee, 'category', category) ORDER BY category, grantee)
    FROM role_classification
  ), '[]'::jsonb),
  'counts', jsonb_build_object(
    'table', (SELECT count(*) FROM raw_table_grants),
    'column', (SELECT count(*) FROM raw_column_grants),
    'routine', (SELECT count(*) FROM raw_routine_grants),
    'sequence', (SELECT count(*) FROM raw_sequence_grants)
  ),
  'tableGrants', coalesce((
    SELECT jsonb_agg(to_jsonb(t) ORDER BY schema, object, grantee, privilege, grantor)
    FROM raw_table_grants t
  ), '[]'::jsonb),
  'columnGrants', coalesce((
    SELECT jsonb_agg(to_jsonb(c) ORDER BY schema, object, column_name, grantee, privilege, grantor)
    FROM raw_column_grants c
  ), '[]'::jsonb),
  'routineGrants', coalesce((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY schema, routine, identity_arguments, grantee, privilege, grantor)
    FROM raw_routine_grants r
  ), '[]'::jsonb),
  'sequenceGrants', coalesce((
    SELECT jsonb_agg(to_jsonb(s) ORDER BY schema, sequence, grantee, privilege, grantor)
    FROM raw_sequence_grants s
  ), '[]'::jsonb)
)::text;
