BEGIN;

DO $canonicalization_preconditions$
DECLARE
  policy_row record;
  canonical_policy_names constant text[] := ARRAY[
    'Admin views all RFQs',
    'Enterprise RFQ managers delete RFQs',
    'Enterprise RFQ managers update RFQs',
    'Enterprise RFQ managers view RFQs',
    'Invited hotel views RFQ',
    'Organizer deletes own RFQ',
    'Organizer inserts own RFQ',
    'Organizer updates own RFQ',
    'Organizer views own RFQ'
  ];
  actual_canonical_policy_names text[];
BEGIN
  IF to_regclass('public.rfqs') IS NULL THEN
    RAISE EXCEPTION 'Canonicalization precondition failed: public.rfqs does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'rfqs'
      AND relation.relkind IN ('r', 'p')
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Canonicalization precondition failed: public.rfqs RLS is not enabled';
  END IF;

  SELECT *
  INTO policy_row
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'rfqs'
    AND policyname = 'Admin updates all RFQs';

  IF FOUND AND NOT (
    lower(policy_row.cmd) = 'update'
    AND lower(policy_row.permissive) = 'permissive'
    AND policy_row.roles = ARRAY['authenticated']::name[]
    AND regexp_replace(btrim(policy_row.qual), '[[:space:]]+', ' ', 'g') =
      'has_role(auth.uid(), ''admin''::app_role)'
    AND regexp_replace(btrim(policy_row.with_check), '[[:space:]]+', ' ', 'g') =
      'has_role(auth.uid(), ''admin''::app_role)'
  ) THEN
    RAISE EXCEPTION 'Canonicalization aborted: Admin updates all RFQs has unexpected semantics';
  END IF;

  SELECT *
  INTO policy_row
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'rfqs'
    AND policyname = 'Admin deletes all RFQs';

  IF FOUND AND NOT (
    lower(policy_row.cmd) = 'delete'
    AND lower(policy_row.permissive) = 'permissive'
    AND policy_row.roles = ARRAY['authenticated']::name[]
    AND regexp_replace(btrim(policy_row.qual), '[[:space:]]+', ' ', 'g') =
      'has_role(auth.uid(), ''admin''::app_role)'
    AND policy_row.with_check IS NULL
  ) THEN
    RAISE EXCEPTION 'Canonicalization aborted: Admin deletes all RFQs has unexpected semantics';
  END IF;

  SELECT array_agg(policyname ORDER BY policyname)
  INTO actual_canonical_policy_names
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'rfqs'
    AND policyname <> ALL (ARRAY['Admin updates all RFQs', 'Admin deletes all RFQs']);

  IF actual_canonical_policy_names IS DISTINCT FROM canonical_policy_names THEN
    RAISE EXCEPTION 'Canonicalization precondition failed: unexpected canonical RFQ policy set: %',
      actual_canonical_policy_names;
  END IF;
END;
$canonicalization_preconditions$;

DROP POLICY IF EXISTS "Admin updates all RFQs" ON public.rfqs;
DROP POLICY IF EXISTS "Admin deletes all RFQs" ON public.rfqs;

DO $canonicalization_postconditions$
DECLARE
  canonical_policy_names constant text[] := ARRAY[
    'Admin views all RFQs',
    'Enterprise RFQ managers delete RFQs',
    'Enterprise RFQ managers update RFQs',
    'Enterprise RFQ managers view RFQs',
    'Invited hotel views RFQ',
    'Organizer deletes own RFQ',
    'Organizer inserts own RFQ',
    'Organizer updates own RFQ',
    'Organizer views own RFQ'
  ];
  actual_policy_names text[];
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rfqs'
      AND policyname IN ('Admin updates all RFQs', 'Admin deletes all RFQs')
  ) THEN
    RAISE EXCEPTION 'Canonicalization postcondition failed: non-canonical RFQ policy remains';
  END IF;

  SELECT array_agg(policyname ORDER BY policyname)
  INTO actual_policy_names
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'rfqs';

  IF actual_policy_names IS DISTINCT FROM canonical_policy_names THEN
    RAISE EXCEPTION 'Canonicalization postcondition failed: RFQ policy set changed unexpectedly: %',
      actual_policy_names;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'rfqs'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Canonicalization postcondition failed: public.rfqs RLS is not enabled';
  END IF;
END;
$canonicalization_postconditions$;

COMMIT;
