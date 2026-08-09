-- Focused, read-only ACL evidence for the deferred account-status trigger hardening.
WITH target AS (
  SELECT
    n.nspname::text AS schema,
    p.proname::text AS function,
    pg_get_function_identity_arguments(p.oid)::text AS identity_arguments,
    owner_role.rolname::text AS owner,
    p.prosecdef AS security_definer,
    coalesce((
      SELECT regexp_replace(setting, '^search_path=', '')
      FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS setting
      WHERE setting LIKE 'search_path=%'
      LIMIT 1
    ), '')::text AS search_path,
    coalesce(jsonb_agg(jsonb_build_object(
      'grantee', coalesce(grantee_role.rolname, 'PUBLIC'),
      'grantor', coalesce(grantor_role.rolname, 'PUBLIC'),
      'privilege', lower(a.privilege_type),
      'grantable', a.is_grantable
    ) ORDER BY coalesce(grantee_role.rolname, 'PUBLIC'), lower(a.privilege_type)), '[]'::jsonb) AS execute_grants
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles owner_role ON owner_role.oid = p.proowner
  CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  LEFT JOIN pg_roles grantee_role ON grantee_role.oid = a.grantee
  LEFT JOIN pg_roles grantor_role ON grantor_role.oid = a.grantor
  WHERE n.nspname = 'public'
    AND p.proname = 'prevent_non_admin_account_status_change'
  GROUP BY n.nspname, p.proname, p.oid, owner_role.rolname, p.prosecdef, p.proconfig
)
SELECT jsonb_build_object(
  'schemaVersion', 1,
  'accessMode', 'isolated_local_catalog_query',
  'functionCount', count(*),
  'functions', coalesce(
    jsonb_agg(to_jsonb(target) ORDER BY schema, function, identity_arguments),
    '[]'::jsonb
  )
)::text
FROM target;
