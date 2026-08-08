-- Public-safe catalog fingerprint. This query reads definitions and privileges only.
-- It must not read application rows, auth identities, credentials, or configuration secrets.
WITH catalog_objects AS (
  SELECT
    'relations'::text AS category,
    format('%I.%I|%s|rls=%s|force=%s', n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity) AS identity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')

  UNION ALL
  SELECT
    'columns',
    format(
      '%I.%I.%I|%s|notnull=%s|default=%s|identity=%s|generated=%s|collation=%s',
      n.nspname,
      c.relname,
      a.attname,
      pg_catalog.format_type(a.atttypid, a.atttypmod),
      a.attnotnull,
      coalesce(pg_get_expr(d.adbin, d.adrelid, true), ''),
      a.attidentity,
      a.attgenerated,
      coalesce(coll.collname, '')
    )
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  LEFT JOIN pg_collation coll ON coll.oid = a.attcollation AND a.attcollation <> 0
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm')
    AND a.attnum > 0
    AND NOT a.attisdropped

  UNION ALL
  SELECT
    'constraints',
    format(
      '%I.%I|%I|%s|%s|validated=%s|deferrable=%s|deferred=%s',
      n.nspname,
      c.relname,
      con.conname,
      con.contype,
      pg_get_constraintdef(con.oid, true),
      con.convalidated,
      con.condeferrable,
      con.condeferred
    )
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'

  UNION ALL
  SELECT 'indexes', format('%I.%I|%s', schemaname, indexname, indexdef)
  FROM pg_indexes
  WHERE schemaname = 'public'

  UNION ALL
  SELECT
    'enums',
    format('%I.%I|%s|%s', n.nspname, t.typname, e.enumsortorder, e.enumlabel)
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE n.nspname = 'public'

  UNION ALL
  SELECT
    'functions',
    format(
      '%I.%I(%s)|result=%s|lang=%s|security_definer=%s|volatility=%s|config=%s|acl=%s|definition=%s',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid),
      pg_get_function_result(p.oid),
      l.lanname,
      p.prosecdef,
      p.provolatile,
      coalesce(array_to_string(p.proconfig, ','), ''),
      coalesce(p.proacl::text, ''),
      pg_get_functiondef(p.oid)
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'

  UNION ALL
  SELECT
    'triggers',
    format('%I.%I|%I|enabled=%s|%s', n.nspname, c.relname, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid, true))
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND (n.nspname = 'public' OR (n.nspname = 'auth' AND c.relname = 'users'))

  UNION ALL
  SELECT
    'policies',
    format(
      '%I.%I|%I|%s|%s|roles=%s|using=%s|check=%s',
      schemaname,
      tablename,
      policyname,
      permissive,
      cmd,
      array_to_string(roles, ','),
      coalesce(qual, ''),
      coalesce(with_check, '')
    )
  FROM pg_policies
  WHERE schemaname IN ('public', 'storage')

  UNION ALL
  SELECT
    'application_table_grants',
    format('%I.%I|grantee=%I|grantor=%I|%s|grantable=%s', table_schema, table_name, grantee, grantor, privilege_type, is_grantable)
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')

  UNION ALL
  SELECT
    'application_column_grants',
    format('%I.%I.%I|grantee=%I|grantor=%I|%s|grantable=%s', table_schema, table_name, column_name, grantee, grantor, privilege_type, is_grantable)
  FROM information_schema.column_privileges
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')

  UNION ALL
  SELECT
    'application_routine_grants',
    format('%I.%I|grantee=%I|grantor=%I|%s|grantable=%s', routine_schema, routine_name, grantee, grantor, privilege_type, is_grantable)
  FROM information_schema.role_routine_grants
  WHERE routine_schema = 'public'
    AND grantee IN ('anon', 'authenticated')

  UNION ALL
  SELECT 'extensions', format('%I|%s|schema=%I', e.extname, e.extversion, n.nspname)
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
), category_fingerprints AS (
  SELECT
    category,
    count(*)::integer AS object_count,
    md5(string_agg(length(identity)::text || ':' || identity, E'\n' ORDER BY identity)) AS definition_md5
  FROM catalog_objects
  GROUP BY category
)
SELECT jsonb_agg(
  jsonb_build_object(
    'category', category,
    'objectCount', object_count,
    'definitionMd5', definition_md5
  )
  ORDER BY category
)::text
FROM category_fingerprints;
