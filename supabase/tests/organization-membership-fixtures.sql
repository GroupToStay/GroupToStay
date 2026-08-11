-- Runs only inside the disposable reconstruction database. All fixture data is rolled back.
BEGIN;

CREATE TEMP TABLE organization_fixture_results (
  fixture text PRIMARY KEY,
  result text NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT condition THEN
    RAISE EXCEPTION '%', message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_forbidden(statement text, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  _failed boolean := false;
  _state text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    _failed := true;
    _state := SQLSTATE;
  END;
  IF NOT _failed OR _state <> '42501' THEN
    RAISE EXCEPTION '% (SQLSTATE %)', message, COALESCE(_state, 'none');
  END IF;
END;
$$;

DO $$
DECLARE
  _agency_owner uuid := '10000000-0000-0000-0000-000000000001';
  _agency_member uuid := '10000000-0000-0000-0000-000000000002';
  _hotel_owner uuid := '10000000-0000-0000-0000-000000000003';
  _admin uuid := '10000000-0000-0000-0000-000000000004';
  _agency_org uuid;
  _member_org uuid;
  _supplier_org uuid;
  _hotel uuid := '10000000-0000-0000-0000-000000000101';
  _viewer_membership uuid := '10000000-0000-0000-0000-000000000201';
  _before_orgs bigint;
  _before_memberships bigint;
BEGIN
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    (
      _agency_owner, 'authenticated', 'authenticated', 'organization-agency-owner@example.test',
      '', '{}'::jsonb,
      '{"role":"organizer","full_name":"Agency Owner","company_name":"Fixture Agency"}'::jsonb,
      now(), now()
    ),
    (
      _agency_member, 'authenticated', 'authenticated', 'organization-agency-member@example.test',
      '', '{}'::jsonb,
      '{"role":"organizer","full_name":"Agency Member","company_name":"Fixture Member Agency"}'::jsonb,
      now(), now()
    ),
    (
      _hotel_owner, 'authenticated', 'authenticated', 'organization-hotel-owner@example.test',
      '', '{}'::jsonb,
      '{"role":"hotel","full_name":"Hotel Owner","company_name":"Fixture Supplier"}'::jsonb,
      now(), now()
    ),
    (
      _admin, 'authenticated', 'authenticated', 'organization-admin@example.test',
      '', '{}'::jsonb,
      '{"role":"organizer","full_name":"Platform Admin"}'::jsonb,
      now(), now()
    );

  -- Auth signup cannot self-assign admin. Convert this isolated fixture account through the
  -- same privileged path used by administration, and remove its temporary marketplace mapping.
  DELETE FROM public.organization_memberships WHERE user_id = _admin;
  DELETE FROM public.organizations WHERE legacy_owner_user_id = _admin;
  DELETE FROM public.user_roles WHERE user_id = _admin;
  INSERT INTO public.user_roles (user_id, role) VALUES (_admin, 'admin');

  _agency_org := public.legacy_organization_id(_agency_owner, 'agency');
  _member_org := public.legacy_organization_id(_agency_member, 'agency');
  _supplier_org := public.legacy_organization_id(_hotel_owner, 'supplier');

  PERFORM pg_temp.assert_true(
    (SELECT count(*) FROM public.organizations WHERE id IN (_agency_org, _member_org, _supplier_org)) = 3,
    'marketplace role provisioning did not create exactly three organizations'
  );
  PERFORM pg_temp.assert_true(
    NOT EXISTS (SELECT 1 FROM public.organizations WHERE legacy_owner_user_id = _admin),
    'platform admin was incorrectly retained as a marketplace organization owner'
  );

  PERFORM pg_temp.assert_true(
    (SELECT agency_verification_status::text FROM public.profiles WHERE id = _agency_owner)
      IN ('draft', 'rejected'),
    'blank display-name fixture requires an editable agency profile'
  );
  PERFORM set_config('request.jwt.claim.sub', _agency_owner::text, true);
  UPDATE public.profiles
  SET trade_name = '', company_name = 'Fixture Agency'
  WHERE id = _agency_owner;
  PERFORM set_config('request.jwt.claim.sub', _admin::text, true);
  DELETE FROM public.organization_memberships WHERE organization_id = _agency_org;
  DELETE FROM public.organizations WHERE id = _agency_org;
  PERFORM public.provision_legacy_organization(_agency_owner, 'agency');
  PERFORM pg_temp.assert_true(
    (SELECT display_name FROM public.organizations WHERE id = _agency_org) = 'Fixture Agency',
    'blank profile fields bypassed the deterministic organization display-name fallback'
  );

  BEGIN
    INSERT INTO public.organization_memberships (
      id, organization_id, user_id, membership_role, status, invited_by, joined_at
    ) VALUES (
      _viewer_membership, _agency_org, _agency_member, 'sales', 'active', _agency_owner, now()
    );
    RAISE EXCEPTION 'agency accepted a supplier-only membership role';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'agency accepted a supplier-only membership role' THEN
        RAISE;
      END IF;
  END;

  INSERT INTO public.organization_memberships (
    id, organization_id, user_id, membership_role, status, invited_by, joined_at
  ) VALUES (
    _viewer_membership, _agency_org, _agency_member, 'viewer', 'active', _agency_owner, now()
  );

  PERFORM pg_temp.assert_true(
    (SELECT count(*) FROM public.organization_memberships WHERE organization_id = _agency_org) = 2,
    'organization does not support multiple members'
  );
  PERFORM pg_temp.assert_true(
    (SELECT count(*) FROM public.organization_memberships WHERE user_id = _agency_member) = 2,
    'user does not support multiple organization memberships'
  );

  INSERT INTO public.hotels (
    id, owner_id, name, slug, city, country, status
  ) VALUES (
    _hotel, _hotel_owner, 'Organization Fixture Hotel', 'organization-fixture-hotel',
    'Riyadh', 'Saudi Arabia', 'approved'
  );
  PERFORM pg_temp.assert_true(
    EXISTS (
      SELECT 1 FROM public.organization_hotel_mappings
      WHERE hotel_id = _hotel AND organization_id = _supplier_org
    ),
    'hotel listing was not mapped to its supplier organization'
  );

  SELECT count(*) INTO _before_orgs FROM public.organizations;
  SELECT count(*) INTO _before_memberships FROM public.organization_memberships;
  PERFORM public.provision_legacy_organization(_agency_owner, 'agency');
  PERFORM pg_temp.assert_true(
    (SELECT count(*) FROM public.organizations) = _before_orgs
      AND (SELECT count(*) FROM public.organization_memberships) = _before_memberships,
    'legacy provisioning is not idempotent'
  );

  PERFORM pg_temp.assert_true(
    (SELECT count(*) FROM public.admin_audit_logs WHERE action = 'organization.created') >= 3,
    'organization creation audit events are missing'
  );
  PERFORM pg_temp.assert_true(
    (SELECT count(*) FROM public.admin_audit_logs WHERE action = 'organization_membership.created') >= 4,
    'membership creation audit events are missing'
  );

  INSERT INTO organization_fixture_results VALUES ('provisioning_and_backfill', 'pass');
  INSERT INTO organization_fixture_results VALUES ('blank_display_name_fallback', 'pass');
  INSERT INTO organization_fixture_results VALUES ('multiple_memberships', 'pass');
  INSERT INTO organization_fixture_results VALUES ('hotel_ownership_mapping', 'pass');
  INSERT INTO organization_fixture_results VALUES ('audit_events', 'pass');
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.organizations) = 1,
  'agency owner can see an organization outside its boundary'
);
SELECT pg_temp.assert_true(
  public.is_active_organization_member(
    '294262da-10f4-883c-1822-72b3458510a5'::uuid
  ),
  'agency owner is not recognized as an active member'
);
SELECT pg_temp.assert_true(
  public.user_organization_role(
    '294262da-10f4-883c-1822-72b3458510a5'::uuid
  ) = 'owner',
  'agency owner role did not resolve'
);
SELECT pg_temp.assert_true(
  public.can_manage_organization(
    '294262da-10f4-883c-1822-72b3458510a5'::uuid
  ),
  'organization owner cannot manage its organization context'
);
SELECT pg_temp.assert_true(
  NOT public.is_active_organization_member('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid),
  'forged organization identifier was accepted'
);
SELECT pg_temp.assert_forbidden(
  $$INSERT INTO public.organization_memberships (
      id, organization_id, user_id, membership_role, status, joined_at
    ) VALUES (
      gen_random_uuid(),
      '294262da-10f4-883c-1822-72b3458510a5'::uuid,
      '10000000-0000-0000-0000-000000000003'::uuid,
      'admin', 'active', now()
    )$$,
  'ordinary member could create an arbitrary membership'
);
SELECT pg_temp.assert_forbidden(
  $$UPDATE public.organization_memberships
    SET membership_role = 'admin'
    WHERE user_id = '10000000-0000-0000-0000-000000000001'::uuid$$,
  'ordinary member could self-escalate its organization role'
);

RESET ROLE;
INSERT INTO organization_fixture_results VALUES ('owner_authorization', 'pass');
INSERT INTO organization_fixture_results VALUES ('mutation_denials', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.organizations) = 2,
  'multi-organization member cannot read both authorized organizations'
);
SELECT pg_temp.assert_true(
  NOT public.can_manage_organization(
    '294262da-10f4-883c-1822-72b3458510a5'::uuid
  ),
  'viewer membership was granted organization management authority'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
UPDATE public.profiles
SET account_status = 'suspended'
WHERE id = '10000000-0000-0000-0000-000000000002'::uuid;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.organizations) = 0,
  'suspended account retained active organization visibility'
);
SELECT pg_temp.assert_true(
  NOT public.is_active_organization_member(
    '41dedda2-4996-a57b-08d8-064c0ba2dd85'::uuid
  ),
  'suspended account retained active membership authority'
);
RESET ROLE;
INSERT INTO organization_fixture_results VALUES ('inactive_membership', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.organizations) = 3,
  'platform admin cannot inspect all organizations'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.organization_memberships) = 4,
  'platform admin cannot inspect all organization memberships'
);
RESET ROLE;
INSERT INTO organization_fixture_results VALUES ('platform_admin_inspection', 'pass');

SET LOCAL ROLE anon;
SELECT pg_temp.assert_forbidden(
  'SELECT id FROM public.organizations LIMIT 1',
  'anonymous caller could read organizations'
);
RESET ROLE;
INSERT INTO organization_fixture_results VALUES ('anonymous_denial', 'pass');

SELECT json_agg(
  json_build_object('fixture', fixture, 'result', result)
  ORDER BY fixture
)::text
FROM organization_fixture_results;

ROLLBACK;
