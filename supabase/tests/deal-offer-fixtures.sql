-- Runs only inside the disposable reconstruction database. All fixture data is rolled back.
BEGIN;

CREATE TEMP TABLE deal_offer_fixture_results (
  fixture text PRIMARY KEY,
  result text NOT NULL
);

CREATE TEMP TABLE deal_offer_fixture_context (
  key text PRIMARY KEY,
  value uuid NOT NULL
);
GRANT SELECT, INSERT ON deal_offer_fixture_context TO authenticated;

CREATE TEMP TABLE deal_offer_v2_counts AS
SELECT
  (SELECT count(*) FROM public.rfqs) AS rfqs,
  (SELECT count(*) FROM public.rfq_invitations) AS invitations,
  (SELECT count(*) FROM public.quotes) AS quotes,
  (SELECT count(*) FROM public.bookings) AS bookings,
  (SELECT count(*) FROM public.hotels) AS hotels,
  (SELECT count(*) FROM public.conversations) AS conversations,
  (SELECT count(*) FROM public.messages) AS messages,
  (SELECT count(*) FROM public.notifications) AS notifications;

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

CREATE OR REPLACE FUNCTION pg_temp.assert_denied(
  statement text,
  expected_states text[],
  message text
)
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
  IF NOT _failed OR NOT (_state = ANY(expected_states)) THEN
    RAISE EXCEPTION '% (SQLSTATE %)', message, COALESCE(_state, 'none');
  END IF;
END;
$$;

DO $$
DECLARE
  _agency_one uuid := '20000000-0000-0000-0000-000000000001';
  _agency_two uuid := '20000000-0000-0000-0000-000000000002';
  _supplier_one uuid := '20000000-0000-0000-0000-000000000003';
  _supplier_two uuid := '20000000-0000-0000-0000-000000000004';
  _admin uuid := '20000000-0000-0000-0000-000000000005';
  _viewer uuid := '20000000-0000-0000-0000-000000000006';
  _hotel_one uuid := '20000000-0000-0000-0000-000000000101';
  _hotel_two uuid := '20000000-0000-0000-0000-000000000102';
  _rfq_one uuid := '20000000-0000-0000-0000-000000000201';
  _rfq_two uuid := '20000000-0000-0000-0000-000000000202';
  _rfq_activation uuid := '20000000-0000-0000-0000-000000000203';
  _invitation_one uuid := '20000000-0000-0000-0000-000000000301';
  _invitation_two uuid := '20000000-0000-0000-0000-000000000302';
  _invitation_activation uuid := '20000000-0000-0000-0000-000000000303';
  _country_id uuid;
  _city_id uuid;
BEGIN
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    (
      _agency_one, 'authenticated', 'authenticated', 'deal-agency-one@example.test', '',
      '{}'::jsonb, '{"role":"organizer","full_name":"Deal Agency One"}'::jsonb, now(), now()
    ),
    (
      _agency_two, 'authenticated', 'authenticated', 'deal-agency-two@example.test', '',
      '{}'::jsonb, '{"role":"organizer","full_name":"Deal Agency Two"}'::jsonb, now(), now()
    ),
    (
      _supplier_one, 'authenticated', 'authenticated', 'deal-supplier-one@example.test', '',
      '{}'::jsonb, '{"role":"hotel","full_name":"Deal Supplier One"}'::jsonb, now(), now()
    ),
    (
      _supplier_two, 'authenticated', 'authenticated', 'deal-supplier-two@example.test', '',
      '{}'::jsonb, '{"role":"hotel","full_name":"Deal Supplier Two"}'::jsonb, now(), now()
    ),
    (
      _admin, 'authenticated', 'authenticated', 'deal-admin@example.test', '',
      '{}'::jsonb, '{"role":"organizer","full_name":"Deal Platform Admin"}'::jsonb, now(), now()
    ),
    (
      _viewer, 'authenticated', 'authenticated', 'deal-viewer@example.test', '',
      '{}'::jsonb, '{"role":"organizer","full_name":"Deal Viewer"}'::jsonb, now(), now()
    );

  DELETE FROM public.organization_memberships WHERE user_id = _admin;
  DELETE FROM public.organizations WHERE legacy_owner_user_id = _admin;
  DELETE FROM public.user_roles WHERE user_id = _admin;
  INSERT INTO public.user_roles (user_id, role) VALUES (_admin, 'admin');

  SELECT country.id, city.id
  INTO _country_id, _city_id
  FROM public.countries country
  JOIN public.cities city ON city.country_id = country.id
  ORDER BY country.code, city.name_en
  LIMIT 1;
  PERFORM pg_temp.assert_true(
    _country_id IS NOT NULL AND _city_id IS NOT NULL,
    'Deal fixture geography is missing'
  );

  PERFORM set_config('request.jwt.claim.sub', _admin::text, true);
  UPDATE public.profiles
  SET agency_verification_status = 'verified',
      legal_company_name = 'Deal Fixture Agency',
      country = 'Fixture Country',
      country_id = _country_id,
      city_id = _city_id,
      full_address = 'Fixture Address',
      cr_number = 'DEAL-FIXTURE-CR',
      cr_expiry_date = current_date + 365,
      issuing_authority = 'Fixture Authority',
      cr_document_path = 'fixture/deal-cr.pdf',
      contact_person_name = 'Fixture Contact',
      contact_person_position = 'Manager',
      contact_person_email = 'deal-contact@example.test',
      contact_person_phone = '+10000000000',
      contact_person_whatsapp = '+10000000001',
      agency_type = 'travel',
      annual_group_bookings = '10',
      avg_rooms_per_booking = '5',
      legal_billing_name = 'Deal Fixture Agency',
      vat_billing_number = 'DEAL-FIXTURE-VAT',
      billing_address = 'Fixture Address',
      billing_email = 'deal-billing@example.test',
      legal_agreements_accepted_at = now()
  WHERE id IN (_agency_one, _agency_two);

  UPDATE public.profiles
  SET company_name = CASE id
        WHEN _supplier_one THEN 'Supplier Fixture Company One'
        ELSE 'Supplier Fixture Company Two'
      END,
      contact_email = CASE id
        WHEN _supplier_one THEN 'supplier-business-one@example.test'
        ELSE 'supplier-business-two@example.test'
      END,
      phone_number = CASE id
        WHEN _supplier_one THEN '+20000000001'
        ELSE '+20000000002'
      END,
      business_address = CASE id
        WHEN _supplier_one THEN 'Supplier Business Address One'
        ELSE 'Supplier Business Address Two'
      END
  WHERE id IN (_supplier_one, _supplier_two);

  UPDATE public.organizations
  SET display_name = CASE legacy_owner_user_id
      WHEN _agency_one THEN 'Deal Fixture Agency One'
      WHEN _agency_two THEN 'Deal Fixture Agency Two'
      WHEN _supplier_one THEN 'Supplier Fixture Company One'
      ELSE 'Supplier Fixture Company Two'
    END
  WHERE legacy_owner_user_id IN (_agency_one, _agency_two, _supplier_one, _supplier_two);

  INSERT INTO public.hotels (id, owner_id, name, slug, city, country, address, status)
  VALUES
    (
      _hotel_one, _supplier_one, 'Deal Supplier Hotel One', 'deal-supplier-hotel-one',
      'Supplier Fixture City One', 'Fixture Country', 'Fixture Address One', 'approved'
    ),
    (
      _hotel_two, _supplier_two, 'Deal Supplier Hotel Two', 'deal-supplier-hotel-two',
      'Supplier Fixture City Two', 'Fixture Country', 'Fixture Address Two', 'approved'
    );

  INSERT INTO public.rfqs (
    id, organizer_id, title, destination_city, destination_country, destination_country_id,
    destination_city_id, check_in, check_out, guests_count, rooms_needed
  ) VALUES
    (
      _rfq_one, _agency_one, 'Deal fixture request one', 'Buyer Fixture City One',
      'Fixture Country', _country_id, _city_id, current_date + 30, current_date + 33, 20, 10
    ),
    (
      _rfq_two, _agency_two, 'Deal fixture request two', 'Buyer Fixture City Two',
      'Fixture Country', _country_id, _city_id, current_date + 35, current_date + 38, 30, 15
    ),
    (
      _rfq_activation, _agency_one, 'Activation journey request', 'Buyer Fixture City One',
      'Fixture Country', _country_id, _city_id, current_date + 40, current_date + 43, 24, 12
    );

  INSERT INTO public.rfq_invitations (id, rfq_id, hotel_id)
  VALUES
    (_invitation_one, _rfq_one, _hotel_one),
    (_invitation_two, _rfq_two, _hotel_two),
    (_invitation_activation, _rfq_activation, _hotel_one);

  INSERT INTO public.organization_memberships (
    id, organization_id, user_id, membership_role, status, invited_by, joined_at
  ) VALUES
    (
      '20000000-0000-0000-0000-000000000601',
      public.legacy_organization_id(_agency_one, 'agency'),
      _viewer, 'viewer', 'active', _agency_one, now()
    ),
    (
      '20000000-0000-0000-0000-000000000602',
      public.legacy_organization_id(_supplier_one, 'supplier'),
      _viewer, 'viewer', 'active', _supplier_one, now()
    );

  INSERT INTO deal_offer_fixture_context (key, value) VALUES
    ('agency_one_user', _agency_one),
    ('agency_two_user', _agency_two),
    ('supplier_one_user', _supplier_one),
    ('supplier_two_user', _supplier_two),
    ('admin_user', _admin),
    ('viewer_user', _viewer),
    ('agency_one_org', public.legacy_organization_id(_agency_one, 'agency')),
    ('agency_two_org', public.legacy_organization_id(_agency_two, 'agency')),
    ('supplier_one_org', public.legacy_organization_id(_supplier_one, 'supplier')),
    ('supplier_two_org', public.legacy_organization_id(_supplier_two, 'supplier')),
    ('hotel_one', _hotel_one),
    ('hotel_two', _hotel_two),
    ('rfq_one', _rfq_one),
    ('rfq_two', _rfq_two),
    ('rfq_activation', _rfq_activation),
    ('invitation_one', _invitation_one),
    ('invitation_two', _invitation_two),
    ('invitation_activation', _invitation_activation),
    ('deal_one', '20000000-0000-0000-0000-000000000401'),
    ('deal_two', '20000000-0000-0000-0000-000000000402'),
    ('offer_one', '20000000-0000-0000-0000-000000000501'),
    ('offer_two', '20000000-0000-0000-0000-000000000502');
END;
$$;

TRUNCATE deal_offer_v2_counts;
INSERT INTO deal_offer_v2_counts
SELECT
  (SELECT count(*) FROM public.rfqs),
  (SELECT count(*) FROM public.rfq_invitations),
  (SELECT count(*) FROM public.quotes),
  (SELECT count(*) FROM public.bookings),
  (SELECT count(*) FROM public.hotels),
  (SELECT count(*) FROM public.conversations),
  (SELECT count(*) FROM public.messages),
  (SELECT count(*) FROM public.notifications);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
INSERT INTO public.deals (
  id, buyer_organization_id, supplier_organization_id, source_rfq_id,
  source_invitation_id, source_hotel_id, created_by
)
SELECT
  deal.value, buyer.value, supplier.value, rfq.value, invitation.value, hotel.value, creator.value
FROM deal_offer_fixture_context deal
JOIN deal_offer_fixture_context buyer ON buyer.key = 'agency_one_org'
JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
JOIN deal_offer_fixture_context rfq ON rfq.key = 'rfq_one'
JOIN deal_offer_fixture_context invitation ON invitation.key = 'invitation_one'
JOIN deal_offer_fixture_context hotel ON hotel.key = 'hotel_one'
JOIN deal_offer_fixture_context creator ON creator.key = 'agency_one_user'
WHERE deal.key = 'deal_one';
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_two_user'),
  true
);
INSERT INTO public.deals (
  id, buyer_organization_id, supplier_organization_id, source_rfq_id,
  source_invitation_id, source_hotel_id, created_by
)
SELECT
  deal.value, buyer.value, supplier.value, rfq.value, invitation.value, hotel.value, creator.value
FROM deal_offer_fixture_context deal
JOIN deal_offer_fixture_context buyer ON buyer.key = 'agency_two_org'
JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_two_org'
JOIN deal_offer_fixture_context rfq ON rfq.key = 'rfq_two'
JOIN deal_offer_fixture_context invitation ON invitation.key = 'invitation_two'
JOIN deal_offer_fixture_context hotel ON hotel.key = 'hotel_two'
JOIN deal_offer_fixture_context creator ON creator.key = 'agency_two_user'
WHERE deal.key = 'deal_two';
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.deals) = 1,
  'Agency member could see another Agency Deal'
);
SELECT pg_temp.assert_denied(
  $$INSERT INTO public.deals (
      buyer_organization_id, supplier_organization_id, source_rfq_id,
      source_invitation_id, source_hotel_id, created_by
    ) SELECT
      buyer.value, forged_supplier.value, rfq.value, invitation.value, hotel.value, creator.value
    FROM deal_offer_fixture_context buyer
    JOIN deal_offer_fixture_context forged_supplier ON forged_supplier.key = 'supplier_two_org'
    JOIN deal_offer_fixture_context rfq ON rfq.key = 'rfq_one'
    JOIN deal_offer_fixture_context invitation ON invitation.key = 'invitation_one'
    JOIN deal_offer_fixture_context hotel ON hotel.key = 'hotel_one'
    JOIN deal_offer_fixture_context creator ON creator.key = 'agency_one_user'
    WHERE buyer.key = 'agency_one_org'$$,
  ARRAY['42501', 'P0001'],
  'Agency member forged Supplier ownership'
);
SELECT pg_temp.assert_forbidden(
  $$INSERT INTO public.deals (
      buyer_organization_id, supplier_organization_id, created_by
    ) SELECT buyer.value, supplier.value, creator.value
    FROM deal_offer_fixture_context buyer
    JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
    JOIN deal_offer_fixture_context creator ON creator.key = 'agency_one_user'
    WHERE buyer.key = 'agency_one_org'$$,
  'Agency member created an unsourced Deal through the direct client path'
);
SELECT pg_temp.assert_forbidden(
  $$INSERT INTO public.offers (deal_id, supplier_organization_id, amount, currency, created_by)
    SELECT deal.value, supplier.value, 1000, 'USD', creator.value
    FROM deal_offer_fixture_context deal
    JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
    JOIN deal_offer_fixture_context creator ON creator.key = 'agency_one_user'
    WHERE deal.key = 'deal_one'$$,
  'Agency member created a Supplier Offer'
);
SELECT pg_temp.assert_forbidden(
  $$UPDATE public.deals SET status = 'closed'
    WHERE id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_one')$$,
  'Agency member received an unguarded Deal update path'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('agency_boundary', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.deals) = 1,
  'Supplier member could see an unrelated Supplier Deal'
);
INSERT INTO public.offers (
  id, deal_id, supplier_organization_id, amount, currency, valid_until, notes, created_by
)
SELECT
  offer.value, deal.value, supplier.value, 1250, 'USD', now() + interval '7 days',
  'Fixture commercial terms', creator.value
FROM deal_offer_fixture_context offer
JOIN deal_offer_fixture_context deal ON deal.key = 'deal_one'
JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
JOIN deal_offer_fixture_context creator ON creator.key = 'supplier_one_user'
WHERE offer.key = 'offer_one';
SELECT pg_temp.assert_denied(
  $$INSERT INTO public.offers (deal_id, supplier_organization_id, amount, currency, created_by)
    SELECT deal.value, forged_supplier.value, 1300, 'USD', creator.value
    FROM deal_offer_fixture_context deal
    JOIN deal_offer_fixture_context forged_supplier ON forged_supplier.key = 'supplier_two_org'
    JOIN deal_offer_fixture_context creator ON creator.key = 'supplier_one_user'
    WHERE deal.key = 'deal_one'$$,
  ARRAY['42501', 'P0001'],
  'Supplier member forged another Supplier organization on an Offer'
);
SELECT pg_temp.assert_forbidden(
  $$INSERT INTO public.deals (
      buyer_organization_id, supplier_organization_id, source_rfq_id,
      source_invitation_id, source_hotel_id, created_by
    ) SELECT
      buyer.value, supplier.value, rfq.value, invitation.value, hotel.value, creator.value
    FROM deal_offer_fixture_context buyer
    JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
    JOIN deal_offer_fixture_context rfq ON rfq.key = 'rfq_one'
    JOIN deal_offer_fixture_context invitation ON invitation.key = 'invitation_one'
    JOIN deal_offer_fixture_context hotel ON hotel.key = 'hotel_one'
    JOIN deal_offer_fixture_context creator ON creator.key = 'supplier_one_user'
    WHERE buyer.key = 'agency_one_org'$$,
  'Supplier member created a buyer-owned Deal'
);
SELECT pg_temp.assert_forbidden(
  $$UPDATE public.offers SET status = 'withdrawn'
    WHERE id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'offer_one')$$,
  'Supplier member received an unguarded Offer update path'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('supplier_boundary', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_two_user'),
  true
);
INSERT INTO public.offers (
  id, deal_id, supplier_organization_id, amount, currency, valid_until, created_by
)
SELECT
  offer.value, deal.value, supplier.value, 2300, 'EUR', now() + interval '5 days', creator.value
FROM deal_offer_fixture_context offer
JOIN deal_offer_fixture_context deal ON deal.key = 'deal_two'
JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_two_org'
JOIN deal_offer_fixture_context creator ON creator.key = 'supplier_two_user'
WHERE offer.key = 'offer_two';
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.offers) = 1,
  'Buyer could see an unrelated Deal Offer'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('offer_visibility', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'viewer_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.deals) = 1,
  'Viewer could not read a participating organization Deal'
);
SELECT pg_temp.assert_forbidden(
  $$INSERT INTO public.deals (
      buyer_organization_id, supplier_organization_id, source_rfq_id,
      source_invitation_id, source_hotel_id, created_by
    ) SELECT
      buyer.value, supplier.value, rfq.value, invitation.value, hotel.value, creator.value
    FROM deal_offer_fixture_context buyer
    JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
    JOIN deal_offer_fixture_context rfq ON rfq.key = 'rfq_one'
    JOIN deal_offer_fixture_context invitation ON invitation.key = 'invitation_one'
    JOIN deal_offer_fixture_context hotel ON hotel.key = 'hotel_one'
    JOIN deal_offer_fixture_context creator ON creator.key = 'viewer_user'
    WHERE buyer.key = 'agency_one_org'$$,
  'Agency Viewer created a Deal'
);
SELECT pg_temp.assert_forbidden(
  $$INSERT INTO public.offers (deal_id, supplier_organization_id, amount, currency, created_by)
    SELECT deal.value, supplier.value, 1350, 'USD', creator.value
    FROM deal_offer_fixture_context deal
    JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
    JOIN deal_offer_fixture_context creator ON creator.key = 'viewer_user'
    WHERE deal.key = 'deal_one'$$,
  'Supplier Viewer submitted an Offer'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('role_scoped_mutations', 'pass');

UPDATE public.organization_memberships
SET status = 'suspended'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_org');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.deals) = 0 AND (SELECT count(*) FROM public.offers) = 0,
  'Inactive Supplier membership retained Deal or Offer authority'
);
SELECT pg_temp.assert_forbidden(
  $$INSERT INTO public.offers (deal_id, supplier_organization_id, amount, currency, created_by)
    SELECT deal.value, supplier.value, 1400, 'USD', creator.value
    FROM deal_offer_fixture_context deal
    JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
    JOIN deal_offer_fixture_context creator ON creator.key = 'supplier_one_user'
    WHERE deal.key = 'deal_one'$$,
  'Inactive Supplier membership submitted an Offer'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('inactive_membership', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'admin_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.deals) = 2 AND (SELECT count(*) FROM public.offers) = 2,
  'Platform Admin cannot inspect Deal and Offer records'
);
SELECT pg_temp.assert_forbidden(
  $$INSERT INTO public.offers (deal_id, supplier_organization_id, amount, currency, created_by)
    SELECT deal.value, supplier.value, 1500, 'USD', creator.value
    FROM deal_offer_fixture_context deal
    JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
    JOIN deal_offer_fixture_context creator ON creator.key = 'admin_user'
    WHERE deal.key = 'deal_one'$$,
  'Platform Admin received implicit Supplier marketplace authority'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('platform_admin_inspection', 'pass');

SET LOCAL ROLE anon;
SELECT pg_temp.assert_forbidden(
  'SELECT id FROM public.deals LIMIT 1',
  'Anonymous caller could read Deals'
);
SELECT pg_temp.assert_forbidden(
  'SELECT id FROM public.offers LIMIT 1',
  'Anonymous caller could read Offers'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('anonymous_denial', 'pass');

DO $$
DECLARE
  _failed boolean := false;
  _state text;
  _amount numeric;
BEGIN
  BEGIN
    UPDATE public.offers
    SET amount = 9999
    WHERE id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'offer_one');
  EXCEPTION WHEN OTHERS THEN
    _failed := true;
    _state := SQLSTATE;
  END;
  SELECT amount INTO _amount
  FROM public.offers
  WHERE id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'offer_one');
  PERFORM pg_temp.assert_true(
    _failed AND _state = 'P0001' AND _amount = 1250,
    'Submitted Offer commercial terms were mutable'
  );
END;
$$;
INSERT INTO deal_offer_fixture_results VALUES ('commercial_immutability', 'pass');

-- Feature 3 lifecycle topology. These unsourced Deals exercise only the additive V3 workflow.
UPDATE public.organization_memberships
SET status = 'active'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_org');

INSERT INTO public.deals (
  id, buyer_organization_id, supplier_organization_id, created_by
)
SELECT deal_id, buyer.value, supplier.value, creator.value
FROM unnest(ARRAY[
  '20000000-0000-0000-0000-000000000411'::uuid,
  '20000000-0000-0000-0000-000000000412'::uuid,
  '20000000-0000-0000-0000-000000000413'::uuid,
  '20000000-0000-0000-0000-000000000414'::uuid,
  '20000000-0000-0000-0000-000000000416'::uuid,
  '20000000-0000-0000-0000-000000000417'::uuid,
  '20000000-0000-0000-0000-000000000418'::uuid
]) deal_id
CROSS JOIN deal_offer_fixture_context buyer
CROSS JOIN deal_offer_fixture_context supplier
CROSS JOIN deal_offer_fixture_context creator
WHERE buyer.key = 'agency_one_org'
  AND supplier.key = 'supplier_one_org'
  AND creator.key = 'agency_one_user';

INSERT INTO public.offers (
  id, deal_id, supplier_organization_id, amount, currency, valid_until, notes, created_by
)
SELECT
  fixture.id,
  fixture.deal_id,
  supplier.value,
  fixture.amount,
  'USD',
  CASE fixture.id
    WHEN '20000000-0000-0000-0000-000000000515'::uuid
      THEN clock_timestamp() + interval '10 milliseconds'
    ELSE clock_timestamp() + interval '30 days'
  END,
  'Workflow fixture terms',
  creator.value
FROM (VALUES
  ('20000000-0000-0000-0000-000000000511'::uuid, '20000000-0000-0000-0000-000000000411'::uuid, 1100::numeric),
  ('20000000-0000-0000-0000-000000000512'::uuid, '20000000-0000-0000-0000-000000000411'::uuid, 1200::numeric),
  ('20000000-0000-0000-0000-000000000513'::uuid, '20000000-0000-0000-0000-000000000413'::uuid, 1300::numeric),
  ('20000000-0000-0000-0000-000000000514'::uuid, '20000000-0000-0000-0000-000000000412'::uuid, 1400::numeric),
  ('20000000-0000-0000-0000-000000000515'::uuid, '20000000-0000-0000-0000-000000000414'::uuid, 1500::numeric),
  ('20000000-0000-0000-0000-000000000517'::uuid, '20000000-0000-0000-0000-000000000417'::uuid, 1700::numeric),
  ('20000000-0000-0000-0000-000000000518'::uuid, '20000000-0000-0000-0000-000000000417'::uuid, 1800::numeric),
  ('20000000-0000-0000-0000-000000000519'::uuid, '20000000-0000-0000-0000-000000000416'::uuid, 1900::numeric),
  ('20000000-0000-0000-0000-000000000520'::uuid, '20000000-0000-0000-0000-000000000416'::uuid, 2000::numeric),
  ('20000000-0000-0000-0000-000000000521'::uuid, '20000000-0000-0000-0000-000000000418'::uuid, 2100::numeric),
  ('20000000-0000-0000-0000-000000000522'::uuid, '20000000-0000-0000-0000-000000000418'::uuid, 2200::numeric)
) fixture(id, deal_id, amount)
CROSS JOIN deal_offer_fixture_context supplier
CROSS JOIN deal_offer_fixture_context creator
WHERE supplier.key = 'supplier_one_org'
  AND creator.key = 'supplier_one_user';

-- No direct status path exists, even for a participating authenticated member.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_forbidden(
  $$UPDATE public.deals SET status = 'cancelled'
    WHERE id = '20000000-0000-0000-0000-000000000411'$$,
  'Agency member directly changed Deal status'
);
SELECT pg_temp.assert_forbidden(
  $$UPDATE public.offers SET status = 'accepted'
    WHERE id = '20000000-0000-0000-0000-000000000511'$$,
  'Agency member directly changed Offer status'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('workflow_direct_mutation_denial', 'pass');

SET LOCAL ROLE anon;
SELECT pg_temp.assert_forbidden(
  $$SELECT public.accept_deal_offer('20000000-0000-0000-0000-000000000511')$$,
  'Anonymous caller executed Deal workflow command'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('workflow_anonymous_denial', 'pass');

-- Supplier, unrelated Agency, and platform Admin cannot accept a buyer-owned Offer.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_forbidden(
  $$SELECT public.accept_deal_offer('20000000-0000-0000-0000-000000000511')$$,
  'Supplier accepted its own Offer'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_two_user'),
  true
);
SELECT pg_temp.assert_forbidden(
  $$SELECT public.accept_deal_offer('20000000-0000-0000-0000-000000000511')$$,
  'Unrelated Agency accepted another Agency Offer'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'admin_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.deals) >= 9,
  'Platform Admin lost inspection access to Deals'
);
SELECT pg_temp.assert_forbidden(
  $$SELECT public.accept_deal_offer('20000000-0000-0000-0000-000000000511')$$,
  'Platform Admin received marketplace acceptance authority'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('workflow_actor_boundaries', 'pass');

-- An inactive buyer membership grants no command authority.
UPDATE public.organization_memberships
SET status = 'suspended'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_forbidden(
  $$SELECT public.accept_deal_offer('20000000-0000-0000-0000-000000000511')$$,
  'Inactive Agency membership retained acceptance authority'
);
RESET ROLE;

UPDATE public.organization_memberships
SET status = 'active'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org');
INSERT INTO deal_offer_fixture_results VALUES ('workflow_inactive_membership', 'pass');

-- Accepting one Offer rejects every submitted competitor and agrees the Deal atomically.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.accept_deal_offer('20000000-0000-0000-0000-000000000511');
SELECT pg_temp.assert_true(
  (SELECT status = 'agreed' FROM public.deals
    WHERE id = '20000000-0000-0000-0000-000000000411')
  AND (SELECT status = 'accepted' FROM public.offers
    WHERE id = '20000000-0000-0000-0000-000000000511')
  AND (SELECT status = 'rejected' FROM public.offers
    WHERE id = '20000000-0000-0000-0000-000000000512')
  AND (SELECT count(*) = 1 FROM public.offers
    WHERE deal_id = '20000000-0000-0000-0000-000000000411' AND status = 'accepted'),
  'Atomic acceptance did not produce one winner and one agreed Deal'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('workflow_atomic_acceptance', 'pass');

CREATE TEMP TABLE workflow_duplicate_audit_before AS
SELECT count(*) AS event_count
FROM public.admin_audit_logs
WHERE entity_id IN (
  '20000000-0000-0000-0000-000000000411',
  '20000000-0000-0000-0000-000000000511',
  '20000000-0000-0000-0000-000000000512'
) AND action IN ('deal.status_changed', 'offer.status_changed');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_true(
  (public.accept_deal_offer('20000000-0000-0000-0000-000000000511') ->> 'idempotent')::boolean,
  'Duplicate acceptance did not return an idempotent result'
);
RESET ROLE;

SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.admin_audit_logs
    WHERE entity_id IN (
      '20000000-0000-0000-0000-000000000411',
      '20000000-0000-0000-0000-000000000511',
      '20000000-0000-0000-0000-000000000512'
    ) AND action IN ('deal.status_changed', 'offer.status_changed'))
    = (SELECT event_count FROM workflow_duplicate_audit_before),
  'Duplicate acceptance created duplicate audit evidence'
);
INSERT INTO deal_offer_fixture_results VALUES ('workflow_duplicate_acceptance', 'pass');

-- Suppliers may withdraw only their own submitted Offer.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_two_user'),
  true
);
SELECT pg_temp.assert_forbidden(
  $$SELECT public.withdraw_deal_offer('20000000-0000-0000-0000-000000000514')$$,
  'Supplier withdrew another Supplier Offer'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT public.withdraw_deal_offer('20000000-0000-0000-0000-000000000514');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.accept_deal_offer('20000000-0000-0000-0000-000000000514')$$,
  ARRAY['55000'],
  'Withdrawn Offer was accepted'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('workflow_supplier_withdrawal', 'pass');

-- Buyers may reject a submitted Offer, which is then terminal.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.reject_deal_offer('20000000-0000-0000-0000-000000000513');
SELECT pg_temp.assert_denied(
  $$SELECT public.accept_deal_offer('20000000-0000-0000-0000-000000000513')$$,
  ARRAY['55000'],
  'Rejected Offer was accepted'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('workflow_agency_rejection', 'pass');

-- Either active participant may materialize expiry, but only after the server deadline.
SELECT pg_sleep(0.03);
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT public.expire_deal_offer('20000000-0000-0000-0000-000000000515');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.accept_deal_offer('20000000-0000-0000-0000-000000000515')$$,
  ARRAY['55000'],
  'Expired Offer was accepted'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('workflow_expiration', 'pass');

-- The database invariant rejects a simultaneous-style two-winner write atomically.
DO $$
DECLARE
  _failed boolean := false;
  _state text;
BEGIN
  BEGIN
    UPDATE public.offers
    SET status = 'accepted'
    WHERE deal_id = '20000000-0000-0000-0000-000000000416';
  EXCEPTION WHEN OTHERS THEN
    _failed := true;
    _state := SQLSTATE;
  END;

  PERFORM pg_temp.assert_true(
    _failed
      AND _state = '23505'
      AND (SELECT count(*) = 2 FROM public.offers
        WHERE deal_id = '20000000-0000-0000-0000-000000000416'
          AND status = 'submitted'),
    'Accepted Offer uniqueness invariant did not roll back the two-winner write'
  );
END;
$$;
INSERT INTO deal_offer_fixture_results VALUES ('workflow_concurrency_invariant', 'pass');

-- A late audit failure must roll back the accepted Offer, competing rejection, and Deal agreement.
CREATE OR REPLACE FUNCTION public.fixture_fail_deal_workflow_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.action = 'deal.status_changed'
     AND NEW.entity_id = '20000000-0000-0000-0000-000000000417' THEN
    RAISE EXCEPTION 'Fixture forced audit failure';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fixture_fail_deal_workflow_audit
BEFORE INSERT ON public.admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.fixture_fail_deal_workflow_audit();

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.accept_deal_offer('20000000-0000-0000-0000-000000000517')$$,
  ARRAY['P0001'],
  'Forced audit failure did not abort acceptance'
);
RESET ROLE;

SELECT pg_temp.assert_true(
  (SELECT status = 'active' FROM public.deals
    WHERE id = '20000000-0000-0000-0000-000000000417')
  AND (SELECT count(*) = 2 FROM public.offers
    WHERE deal_id = '20000000-0000-0000-0000-000000000417'
      AND status = 'submitted')
  AND (SELECT count(*) = 0 FROM public.admin_audit_logs
    WHERE entity_id IN (
      '20000000-0000-0000-0000-000000000417',
      '20000000-0000-0000-0000-000000000517',
      '20000000-0000-0000-0000-000000000518'
    ) AND action IN ('deal.status_changed', 'offer.status_changed')),
  'Failed acceptance left partial state or audit evidence'
);

DROP TRIGGER fixture_fail_deal_workflow_audit ON public.admin_audit_logs;
DROP FUNCTION public.fixture_fail_deal_workflow_audit();
INSERT INTO deal_offer_fixture_results VALUES ('workflow_atomic_rollback', 'pass');

-- Cancelling an active Deal rejects its submitted Offers and remains terminal.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.cancel_deal('20000000-0000-0000-0000-000000000418');
SELECT pg_temp.assert_true(
  (SELECT status = 'cancelled' FROM public.deals
    WHERE id = '20000000-0000-0000-0000-000000000418')
  AND (SELECT count(*) = 2 FROM public.offers
    WHERE deal_id = '20000000-0000-0000-0000-000000000418'
      AND status = 'rejected'),
  'Deal cancellation did not terminate submitted Offers'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.close_deal('20000000-0000-0000-0000-000000000418')$$,
  ARRAY['55000'],
  'Cancelled Deal was closed'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('workflow_cancellation', 'pass');

-- Agreed Deals may close, but cannot be cancelled or leave their terminal state.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.close_deal('20000000-0000-0000-0000-000000000411');
SELECT pg_temp.assert_denied(
  $$SELECT public.cancel_deal('20000000-0000-0000-0000-000000000411')$$,
  ARRAY['55000'],
  'Closed Deal was cancelled'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.close_deal('20000000-0000-0000-0000-000000000411')$$,
  ARRAY['55000'],
  'Closed Deal transitioned again'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('workflow_terminal_deal', 'pass');

SELECT pg_temp.assert_true(
  (SELECT count(*) = 2 FROM public.admin_audit_logs
    WHERE entity_id = '20000000-0000-0000-0000-000000000411'
      AND action = 'deal.status_changed')
  AND (SELECT count(*) = 1 FROM public.admin_audit_logs
    WHERE entity_id = '20000000-0000-0000-0000-000000000511'
      AND action = 'offer.status_changed'
      AND actor_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_user'))
  AND (SELECT count(*) = 1 FROM public.admin_audit_logs
    WHERE entity_id = '20000000-0000-0000-0000-000000000514'
      AND action = 'offer.status_changed'
      AND actor_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_user')),
  'Deal workflow audit evidence is incomplete or has the wrong actor'
);
INSERT INTO deal_offer_fixture_results VALUES ('workflow_audit_evidence', 'pass');

-- Feature 5 Offer Thread and immutable Offer Version topology.
INSERT INTO public.deals (
  id, buyer_organization_id, supplier_organization_id, created_by
)
SELECT deal_id, buyer.value, supplier.value, creator.value
FROM unnest(ARRAY[
  '20000000-0000-0000-0000-000000000711'::uuid,
  '20000000-0000-0000-0000-000000000712'::uuid,
  '20000000-0000-0000-0000-000000000713'::uuid
]) deal_id
CROSS JOIN deal_offer_fixture_context buyer
CROSS JOIN deal_offer_fixture_context supplier
CROSS JOIN deal_offer_fixture_context creator
WHERE buyer.key = 'agency_one_org'
  AND supplier.key = 'supplier_one_org'
  AND creator.key = 'agency_one_user';

-- A user active on both Deal sides has no unambiguous commercial authority.
INSERT INTO public.organization_memberships (
  id, organization_id, user_id, membership_role, status, invited_by, joined_at
)
SELECT
  '20000000-0000-0000-0000-000000000699',
  supplier.value,
  agency.value,
  'sales',
  'active',
  supplier_user.value,
  now()
FROM deal_offer_fixture_context supplier
CROSS JOIN deal_offer_fixture_context agency
CROSS JOIN deal_offer_fixture_context supplier_user
WHERE supplier.key = 'supplier_one_org'
  AND agency.key = 'agency_one_user'
  AND supplier_user.key = 'supplier_one_user';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.submit_initial_deal_offer(
      '20000000-0000-0000-0000-000000000711', 3000, 'USD',
      '2099-01-01T00:00:00Z', 'Dual membership attempt',
      '20000000-0000-0000-0000-000000000705')$$,
  ARRAY['42501'],
  'Dual-sided member received Supplier command authority'
);
RESET ROLE;

DELETE FROM public.organization_memberships
WHERE id = '20000000-0000-0000-0000-000000000699';
INSERT INTO deal_offer_fixture_results VALUES ('revision_dual_membership_denial', 'pass');

-- Only the participating Supplier may create the initial immutable version.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.submit_initial_deal_offer(
      '20000000-0000-0000-0000-000000000711', 3000, 'USD',
      '2099-01-01T00:00:00Z', 'Agency cannot submit the initial Offer',
      '20000000-0000-0000-0000-000000000701')$$,
  ARRAY['42501'],
  'Agency submitted an initial Supplier Offer'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_two_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.submit_initial_deal_offer(
      '20000000-0000-0000-0000-000000000711', 3000, 'USD',
      '2099-01-01T00:00:00Z', 'Unrelated Supplier attempt',
      '20000000-0000-0000-0000-000000000702')$$,
  ARRAY['42501'],
  'Unrelated Supplier submitted an initial Offer'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_true(
  NOT (public.submit_initial_deal_offer(
    '20000000-0000-0000-0000-000000000711',
    3000,
    'usd',
    '2099-01-01T00:00:00Z',
    'Initial supplier terms',
    '20000000-0000-0000-0000-000000000701'
  ) ->> 'idempotent')::boolean,
  'Initial Offer command unexpectedly reported a retry'
);
SELECT pg_temp.assert_true(
  (public.submit_initial_deal_offer(
    '20000000-0000-0000-0000-000000000711',
    3000,
    'usd',
    '2099-01-01T00:00:00Z',
    'Initial supplier terms',
    '20000000-0000-0000-0000-000000000701'
  ) ->> 'idempotent')::boolean,
  'Initial Offer retry was not idempotent'
);
RESET ROLE;

SELECT pg_temp.assert_true(
  (SELECT count(*) = 1
   FROM public.offer_threads
   WHERE deal_id = '20000000-0000-0000-0000-000000000711')
  AND (SELECT count(*) = 1
       FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000711'
         AND version_number = 1
         AND amount = 3000
         AND currency = 'USD'),
  'Initial Offer retry created duplicate commercial history'
);
INSERT INTO deal_offer_fixture_results VALUES ('revision_initial_offer_idempotency', 'pass');

-- Authenticated Suppliers cannot append or forge version history through direct INSERT.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_forbidden(
  $$INSERT INTO public.offers (
      deal_id, supplier_organization_id, offer_thread_id, version_number,
      submitted_by_organization_id, parent_offer_id, amount, currency,
      valid_until, notes, status, created_by
    )
    SELECT
      '20000000-0000-0000-0000-000000000711',
      supplier.value,
      offer.offer_thread_id,
      2,
      buyer.value,
      offer.id,
      2800,
      'USD',
      '2099-01-03T00:00:00Z',
      'Forged direct counter',
      'submitted',
      actor.value
    FROM public.offers offer
    CROSS JOIN deal_offer_fixture_context supplier
    CROSS JOIN deal_offer_fixture_context buyer
    CROSS JOIN deal_offer_fixture_context actor
    WHERE offer.deal_id = '20000000-0000-0000-0000-000000000711'
      AND offer.version_number = 1
      AND supplier.key = 'supplier_one_org'
      AND buyer.key = 'agency_one_org'
      AND actor.key = 'supplier_one_user'$$,
  'Supplier appended forged Offer Version through direct INSERT'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('revision_direct_append_denial', 'pass');

-- A party cannot counter its own latest Offer Version.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.counter_deal_offer(
      (SELECT id FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000711'
         AND version_number = 1),
      2950, 'USD', '2099-01-02T00:00:00Z', 'Supplier own-counter attempt')$$,
  ARRAY['55000'],
  'Supplier countered its own latest Offer Version'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('revision_own_counter_denial', 'pass');

-- Alternate Agency and Supplier counters without overwriting prior terms.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.counter_deal_offer(
  (SELECT id FROM public.offers
   WHERE deal_id = '20000000-0000-0000-0000-000000000711' AND version_number = 1),
  2800, 'USD', '2099-01-03T00:00:00Z', 'Agency counter v2'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT public.counter_deal_offer(
  (SELECT id FROM public.offers
   WHERE deal_id = '20000000-0000-0000-0000-000000000711' AND version_number = 2),
  2900, 'USD', '2099-01-04T00:00:00Z', 'Supplier counter v3'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.counter_deal_offer(
  (SELECT id FROM public.offers
   WHERE deal_id = '20000000-0000-0000-0000-000000000711' AND version_number = 3),
  2825, 'USD', '2099-01-05T00:00:00Z', 'Agency counter v4'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT public.counter_deal_offer(
  (SELECT id FROM public.offers
   WHERE deal_id = '20000000-0000-0000-0000-000000000711' AND version_number = 4),
  2875, 'USD', '2099-01-06T00:00:00Z', 'Supplier counter v5'
);
RESET ROLE;

SELECT pg_temp.assert_true(
  (SELECT count(*) = 5
   FROM public.offers
   WHERE deal_id = '20000000-0000-0000-0000-000000000711')
  AND (SELECT array_agg(version_number ORDER BY version_number) = ARRAY[1,2,3,4,5]::bigint[]
       FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000711')
  AND (SELECT count(*) = 4
       FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000711'
         AND status = 'superseded')
  AND (SELECT count(*) = 1
       FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000711'
         AND status = 'submitted'
         AND version_number = 5),
  'Alternating counters did not preserve a monotonic immutable history'
);
INSERT INTO deal_offer_fixture_results VALUES ('revision_unlimited_alternating_rounds', 'pass');

-- Stale parents, unrelated organizations, and inactive memberships fail closed.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.counter_deal_offer(
      (SELECT id FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000711'
         AND version_number = 3),
      2810, 'USD', '2099-01-07T00:00:00Z', 'Stale parent attempt')$$,
  ARRAY['40001', '55000'],
  'Agency countered a stale parent Offer Version'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_two_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.counter_deal_offer(
      (SELECT id FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000711'
         AND version_number = 5),
      2800, 'USD', '2099-01-07T00:00:00Z', 'Unrelated Agency attempt')$$,
  ARRAY['42501'],
  'Unrelated Agency countered another organization Deal'
);
RESET ROLE;

UPDATE public.organization_memberships
SET status = 'suspended'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.counter_deal_offer(
      (SELECT id FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000711'
         AND version_number = 5),
      2800, 'USD', '2099-01-07T00:00:00Z', 'Inactive Agency attempt')$$,
  ARRAY['42501'],
  'Inactive Agency membership retained counteroffer authority'
);
RESET ROLE;

UPDATE public.organization_memberships
SET status = 'active'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org');
INSERT INTO deal_offer_fixture_results VALUES ('revision_authority_boundaries', 'pass');

-- A second same-sequence response fails atomically and leaves no partial child or audit event.
DO $$
DECLARE
  _thread_id uuid;
  _parent_id uuid;
  _failed boolean := false;
  _state text;
BEGIN
  SELECT offer_thread_id, id INTO _thread_id, _parent_id
  FROM public.offers
  WHERE deal_id = '20000000-0000-0000-0000-000000000711'
    AND version_number = 5;

  BEGIN
    INSERT INTO public.offers (
      deal_id, supplier_organization_id, offer_thread_id, version_number,
      submitted_by_organization_id, parent_offer_id, amount, currency,
      valid_until, notes, status, created_by
    )
    SELECT
      '20000000-0000-0000-0000-000000000711',
      supplier.value,
      _thread_id,
      6,
      buyer.value,
      _parent_id,
      2800,
      'USD',
      '2099-01-07T00:00:00Z',
      'First simultaneous-style child',
      'submitted',
      creator.value
    FROM deal_offer_fixture_context supplier
    CROSS JOIN deal_offer_fixture_context buyer
    CROSS JOIN deal_offer_fixture_context creator
    WHERE supplier.key = 'supplier_one_org'
      AND buyer.key = 'agency_one_org'
      AND creator.key = 'agency_one_user';

    INSERT INTO public.offers (
      deal_id, supplier_organization_id, offer_thread_id, version_number,
      submitted_by_organization_id, parent_offer_id, amount, currency,
      valid_until, notes, status, created_by
    )
    SELECT
      '20000000-0000-0000-0000-000000000711',
      supplier.value,
      _thread_id,
      6,
      buyer.value,
      _parent_id,
      2790,
      'USD',
      '2099-01-07T00:00:00Z',
      'Second simultaneous-style child',
      'submitted',
      creator.value
    FROM deal_offer_fixture_context supplier
    CROSS JOIN deal_offer_fixture_context buyer
    CROSS JOIN deal_offer_fixture_context creator
    WHERE supplier.key = 'supplier_one_org'
      AND buyer.key = 'agency_one_org'
      AND creator.key = 'agency_one_user';
  EXCEPTION WHEN OTHERS THEN
    _failed := true;
    _state := SQLSTATE;
  END;

  PERFORM pg_temp.assert_true(
    _failed
      AND _state = '23505'
      AND (SELECT count(*) = 0
           FROM public.offers
           WHERE offer_thread_id = _thread_id AND version_number = 6)
      AND (SELECT count(*) = 0
           FROM public.admin_audit_logs
           WHERE action = 'offer.version_submitted'
             AND entity_id IN (
               SELECT id::text FROM public.offers
               WHERE offer_thread_id = _thread_id AND version_number = 6
             )),
    'Offer Version sequence uniqueness did not roll back a duplicate child transaction'
  );
END;
$$;
INSERT INTO deal_offer_fixture_results VALUES ('revision_concurrency_sequence', 'pass');

-- Commercial lineage and terms remain immutable after every revision.
DO $$
DECLARE
  _failed boolean := false;
  _state text;
BEGIN
  BEGIN
    UPDATE public.offers
    SET amount = 1, version_number = 99
    WHERE deal_id = '20000000-0000-0000-0000-000000000711'
      AND version_number = 1;
  EXCEPTION WHEN OTHERS THEN
    _failed := true;
    _state := SQLSTATE;
  END;
  PERFORM pg_temp.assert_true(
    _failed
      AND _state = 'P0001'
      AND (SELECT amount = 3000 AND version_number = 1
           FROM public.offers
           WHERE deal_id = '20000000-0000-0000-0000-000000000711'
             AND version_number = 1),
    'Historical Offer Version commercial terms or lineage were mutable'
  );
END;
$$;
INSERT INTO deal_offer_fixture_results VALUES ('revision_history_immutability', 'pass');

-- Buyer acceptance targets the latest Supplier version and freezes the Deal atomically.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.accept_deal_offer(
  (SELECT id FROM public.offers
   WHERE deal_id = '20000000-0000-0000-0000-000000000711' AND version_number = 5)
);
SELECT pg_temp.assert_denied(
  $$SELECT public.counter_deal_offer(
      (SELECT id FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000711'
         AND version_number = 5),
      2800, 'USD', '2099-01-08T00:00:00Z', 'Counter after agreement')$$,
  ARRAY['55000'],
  'Counteroffer was submitted after Deal agreement'
);
RESET ROLE;

SELECT pg_temp.assert_true(
  (SELECT status = 'agreed'
   FROM public.deals
   WHERE id = '20000000-0000-0000-0000-000000000711')
  AND (SELECT count(*) = 1
       FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000711'
         AND status = 'accepted'
         AND version_number = 5)
  AND (SELECT count(*) = 4
       FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000711'
         AND status = 'superseded'),
  'Version-specific acceptance did not preserve history or produce one winner'
);
INSERT INTO deal_offer_fixture_results VALUES ('revision_atomic_acceptance', 'pass');

-- A completed Supplier withdrawal wins over a later counter attempt without partial state.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT public.submit_initial_deal_offer(
  '20000000-0000-0000-0000-000000000712',
  4100,
  'USD',
  '2099-02-01T00:00:00Z',
  'Withdrawal race offer',
  '20000000-0000-0000-0000-000000000703'
);
SELECT public.withdraw_deal_offer(
  (SELECT id FROM public.offers
   WHERE deal_id = '20000000-0000-0000-0000-000000000712' AND version_number = 1)
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.counter_deal_offer(
      (SELECT id FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000712'
         AND version_number = 1),
      4000, 'USD', '2099-02-02T00:00:00Z', 'Late counter after withdrawal')$$,
  ARRAY['55000'],
  'Counteroffer succeeded after Supplier withdrawal'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('revision_counter_withdraw_race', 'pass');

-- Cancelled Deals reject current versions and do not accept new counters.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT public.submit_initial_deal_offer(
  '20000000-0000-0000-0000-000000000713',
  5100,
  'USD',
  '2099-03-01T00:00:00Z',
  'Cancellation fixture offer',
  '20000000-0000-0000-0000-000000000704'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.cancel_deal('20000000-0000-0000-0000-000000000713');
SELECT pg_temp.assert_denied(
  $$SELECT public.counter_deal_offer(
      (SELECT id FROM public.offers
       WHERE deal_id = '20000000-0000-0000-0000-000000000713'
         AND version_number = 1),
      5000, 'USD', '2099-03-02T00:00:00Z', 'Counter after cancellation')$$,
  ARRAY['55000'],
  'Counteroffer succeeded after Deal cancellation'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('revision_terminal_deal_denial', 'pass');

SELECT pg_temp.assert_true(
  (SELECT count(*) = 5
   FROM public.admin_audit_logs log
   JOIN public.offers offer ON offer.id::text = log.entity_id
   WHERE offer.deal_id = '20000000-0000-0000-0000-000000000711'
     AND log.action = 'offer.version_submitted')
  AND (SELECT count(*) = 4
       FROM public.admin_audit_logs log
       JOIN public.offers offer ON offer.id::text = log.entity_id
       WHERE offer.deal_id = '20000000-0000-0000-0000-000000000711'
         AND log.action = 'offer.status_changed'
         AND log.new_state ->> 'status' = 'superseded')
  AND (SELECT count(*) = 4
       FROM public.admin_audit_logs log
       JOIN public.offer_threads thread ON thread.id::text = log.entity_id
       WHERE thread.deal_id = '20000000-0000-0000-0000-000000000711'
         AND log.action = 'offer_thread.version_advanced')
  AND NOT EXISTS (
    SELECT 1
    FROM public.admin_audit_logs log
    WHERE log.entity_id IN (
      SELECT id::text FROM public.offers
      WHERE deal_id = '20000000-0000-0000-0000-000000000711'
    )
      AND log.metadata::text ~* '@|phone|email|contact'
  ),
  'Offer revision audit evidence is incomplete or contains contact identity data'
);
INSERT INTO deal_offer_fixture_results VALUES ('revision_audit_evidence', 'pass');

SELECT pg_temp.assert_true(
  current_counts.rfqs = baseline.rfqs
    AND current_counts.invitations = baseline.invitations
    AND current_counts.quotes = baseline.quotes
    AND current_counts.bookings = baseline.bookings
    AND current_counts.hotels = baseline.hotels
    AND current_counts.conversations = baseline.conversations
    AND current_counts.messages = baseline.messages
    AND current_counts.notifications = baseline.notifications,
  'Deal and Offer operations changed existing V2 business records'
)
FROM deal_offer_v2_counts baseline
CROSS JOIN LATERAL (
  SELECT
    (SELECT count(*) FROM public.rfqs) AS rfqs,
    (SELECT count(*) FROM public.rfq_invitations) AS invitations,
    (SELECT count(*) FROM public.quotes) AS quotes,
    (SELECT count(*) FROM public.bookings) AS bookings,
    (SELECT count(*) FROM public.hotels) AS hotels,
    (SELECT count(*) FROM public.conversations) AS conversations,
    (SELECT count(*) FROM public.messages) AS messages,
    (SELECT count(*) FROM public.notifications) AS notifications
) current_counts;
INSERT INTO deal_offer_fixture_results VALUES ('v2_compatibility', 'pass');

-- Private Deal Chat reuses the V2 conversation/message tables without V2 participant rows.
INSERT INTO public.deals (
  id, buyer_organization_id, supplier_organization_id, created_by
)
SELECT
  '20000000-0000-0000-0000-000000000801',
  buyer.value,
  supplier.value,
  creator.value
FROM deal_offer_fixture_context buyer
JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
JOIN deal_offer_fixture_context creator ON creator.key = 'agency_one_user'
WHERE buyer.key = 'agency_one_org';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_true(
  public.ensure_deal_conversation('20000000-0000-0000-0000-000000000801') =
    public.ensure_deal_conversation('20000000-0000-0000-0000-000000000801'),
  'Deal conversation provisioning was not idempotent'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_context (key, value)
SELECT 'deal_chat_conversation', conversation.id
FROM public.conversations conversation
WHERE conversation.deal_id = '20000000-0000-0000-0000-000000000801';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.send_deal_message(
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org'),
  '  Agency clarification  '
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.conversations
   WHERE deal_id = '20000000-0000-0000-0000-000000000801') = 1
  AND (SELECT body = 'Agency clarification'
       FROM public.chat_messages
       WHERE conversation_id = (
         SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'
       )),
  'Deal conversation or message provisioning is invalid'
);
SELECT pg_temp.assert_denied(
  $$INSERT INTO public.chat_messages (
      conversation_id, sender_id, sender_organization_id, body
    ) SELECT
      conversation.value, actor.value, organization.value, 'Direct Deal message'
    FROM deal_offer_fixture_context conversation
    JOIN deal_offer_fixture_context actor ON actor.key = 'agency_one_user'
    JOIN deal_offer_fixture_context organization ON organization.key = 'agency_one_org'
    WHERE conversation.key = 'deal_chat_conversation'$$,
  ARRAY['42501'],
  'Agency bypassed the Deal message command'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.send_deal_message(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_org'),
      'Forged supplier sender')$$,
  ARRAY['42501'],
  'Agency forged the Supplier organization sender'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.send_deal_message(
      '20000000-0000-0000-0000-000000009999',
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org'),
      'Forged conversation')$$,
  ARRAY['42501'],
  'Agency used a forged conversation identifier'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.send_deal_message(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org'),
      '   ')$$,
  ARRAY['22023'],
  'Blank Deal message was accepted'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.send_deal_message(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org'),
      repeat('x', 4001))$$,
  ARRAY['22023'],
  'Oversized Deal message was accepted'
);
SELECT public.send_deal_message(
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org'),
  '<script>alert("safe text")</script>'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.admin_audit_logs
   WHERE action = 'deal_chat.conversation_created'
     AND entity_id = (
       SELECT value::text FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'
     )) = 1,
  'Deal conversation audit evidence is invalid'
);
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_agency_authority', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.conversations
   WHERE deal_id = '20000000-0000-0000-0000-000000000801') = 1
  AND (SELECT count(*) FROM public.chat_messages
       WHERE conversation_id = (
         SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'
       )) = 2,
  'Supplier could not read its Deal conversation history'
);
SELECT public.send_deal_message(
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_org'),
  'Supplier clarification'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_supplier_authority', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_two_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.conversations
   WHERE deal_id = '20000000-0000-0000-0000-000000000801') = 0
  AND (SELECT count(*) FROM public.chat_messages
       WHERE conversation_id = (
         SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'
       )) = 0,
  'Unrelated Supplier could inspect Deal Chat'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.send_deal_message(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_two_org'),
      'Unrelated Supplier message')$$,
  ARRAY['42501'],
  'Unrelated Supplier sent a Deal message'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_unrelated_supplier_denial', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_two_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.conversations
   WHERE deal_id = '20000000-0000-0000-0000-000000000801') = 0
  AND (SELECT count(*) FROM public.chat_messages
       WHERE conversation_id = (
         SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'
       )) = 0,
  'Unrelated Agency could inspect Deal Chat'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.ensure_deal_conversation('20000000-0000-0000-0000-000000000801')$$,
  ARRAY['42501'],
  'Unrelated Agency provisioned Deal Chat'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.send_deal_message(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_two_org'),
      'Cross-organization message')$$,
  ARRAY['42501'],
  'Unrelated Agency sent a Deal message'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_cross_organization_denial', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'admin_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.conversations
   WHERE deal_id = '20000000-0000-0000-0000-000000000801') = 1
  AND (SELECT count(*) FROM public.chat_messages
       WHERE conversation_id = (
         SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'
       )) = 3,
  'Platform Admin inspection did not follow the canonical Deal policy'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.send_deal_message(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org'),
      'Admin impersonation')$$,
  ARRAY['42501'],
  'Platform Admin gained marketplace sender authority'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_admin_inspection_only', 'pass');

UPDATE public.organization_memberships
SET status = 'suspended'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_org');
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.conversations
   WHERE deal_id = '20000000-0000-0000-0000-000000000801') = 0,
  'Inactive Supplier membership retained Deal Chat read access'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.send_deal_message(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_org'),
      'Inactive member message')$$,
  ARRAY['42501'],
  'Inactive Supplier membership retained Deal Chat send access'
);
RESET ROLE;
UPDATE public.organization_memberships
SET status = 'active'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_org');
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_inactive_member_denial', 'pass');

UPDATE public.organization_memberships
SET membership_role = 'viewer'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org');
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.send_deal_message(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org'),
      'Viewer message')$$,
  ARRAY['42501'],
  'Viewer gained commercial Deal Chat send authority'
);
RESET ROLE;
UPDATE public.organization_memberships
SET membership_role = 'owner'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org');
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_role_boundary', 'pass');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT pg_temp.assert_denied(
  $$SELECT count(*) FROM public.conversations$$,
  ARRAY['42501'],
  'Anonymous caller could inspect Deal conversations'
);
SELECT pg_temp.assert_denied(
  $$SELECT count(*) FROM public.chat_messages$$,
  ARRAY['42501'],
  'Anonymous caller could inspect Deal messages'
);
SELECT pg_temp.assert_denied(
  $$SELECT public.ensure_deal_conversation('20000000-0000-0000-0000-000000000801')$$,
  ARRAY['42501'],
  'Anonymous caller executed Deal Chat provisioning'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_anonymous_denial', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
UPDATE public.chat_messages
SET body = 'Tampered message'
WHERE conversation_id = (
  SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'
);
DELETE FROM public.chat_messages
WHERE conversation_id = (
  SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.chat_messages
   WHERE conversation_id = (
     SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'
   )) = 3
  AND EXISTS (
    SELECT 1 FROM public.chat_messages
    WHERE conversation_id = (
      SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'
    )
      AND body = '<script>alert("safe text")</script>'
  ),
  'Ordinary participant changed immutable Deal message history'
);
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_immutability', 'pass');

UPDATE public.deals
SET status = 'cancelled'
WHERE id = '20000000-0000-0000-0000-000000000801';
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.send_deal_message(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_chat_conversation'),
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org'),
      'Cancelled Deal message')$$,
  ARRAY['55000'],
  'Cancelled Deal Chat remained writable'
);
RESET ROLE;

INSERT INTO public.deals (
  id, buyer_organization_id, supplier_organization_id, status, created_by
)
SELECT
  '20000000-0000-0000-0000-000000000802',
  buyer.value,
  supplier.value,
  'closed',
  creator.value
FROM deal_offer_fixture_context buyer
JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
JOIN deal_offer_fixture_context creator ON creator.key = 'agency_one_user'
WHERE buyer.key = 'agency_one_org';
INSERT INTO public.conversations (deal_id)
VALUES ('20000000-0000-0000-0000-000000000802');
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.send_deal_message(
      (SELECT id FROM public.conversations
       WHERE deal_id = '20000000-0000-0000-0000-000000000802'),
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org'),
      'Closed Deal message')$$,
  ARRAY['55000'],
  'Closed Deal Chat remained writable'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_terminal_read_only', 'pass');

INSERT INTO public.deals (
  id, buyer_organization_id, supplier_organization_id, status, created_by
)
SELECT
  '20000000-0000-0000-0000-000000000803',
  buyer.value,
  supplier.value,
  'agreed',
  creator.value
FROM deal_offer_fixture_context buyer
JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
JOIN deal_offer_fixture_context creator ON creator.key = 'agency_one_user'
WHERE buyer.key = 'agency_one_org';
INSERT INTO public.conversations (deal_id)
VALUES ('20000000-0000-0000-0000-000000000803');
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.send_deal_message(
  (SELECT id FROM public.conversations
   WHERE deal_id = '20000000-0000-0000-0000-000000000803'),
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org'),
  'Agreed Deal operational clarification'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.chat_messages message
    JOIN public.conversations conversation ON conversation.id = message.conversation_id
    WHERE conversation.deal_id = '20000000-0000-0000-0000-000000000803'
      AND message.body = 'Agreed Deal operational clarification'
  ),
  'Agreed Deal Chat rejected an authorized operational clarification'
);
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_agreed_writable', 'pass');

-- Deal contact reveal is denied before agreement and created atomically by acceptance.
INSERT INTO public.deals (
  id, buyer_organization_id, supplier_organization_id, created_by
)
SELECT
  '20000000-0000-0000-0000-000000000804',
  buyer.value,
  supplier.value,
  creator.value
FROM deal_offer_fixture_context buyer
JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
JOIN deal_offer_fixture_context creator ON creator.key = 'agency_one_user'
WHERE buyer.key = 'agency_one_org';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
INSERT INTO deal_offer_fixture_context (key, value)
SELECT
  'contact_reveal_offer',
  (public.submit_initial_deal_offer(
    '20000000-0000-0000-0000-000000000804',
    9100,
    'SAR',
    now() + interval '10 days',
    'Contact reveal fixture offer',
    '20000000-0000-0000-0000-000000000805'
  )->>'offer_id')::uuid;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT * FROM public.get_deal_counterparty_contact(
      '20000000-0000-0000-0000-000000000804'
    )$$,
  ARRAY['42501'],
  'Agency retrieved Supplier contact before agreement'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.profiles
   WHERE id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_user')) = 0,
  'Agency gained direct access to the Supplier profile'
);
SELECT public.accept_deal_offer(
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'contact_reveal_offer')
);
SELECT public.accept_deal_offer(
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'contact_reveal_offer')
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.deal_contact_reveals
   WHERE deal_id = '20000000-0000-0000-0000-000000000804') = 0,
  'Participant gained direct reveal-evidence table access'
);
SELECT pg_temp.assert_true(
  contact.business_name = 'Supplier Fixture Company One'
    AND contact.contact_name IS NULL
    AND contact.email = 'supplier-business-one@example.test'
    AND contact.phone = '+20000000001'
    AND contact.whatsapp IS NULL
    AND contact.address = 'Supplier Business Address One'
    AND contact.organization_type = 'supplier'
    AND contact.policy_version = 'deal-contact-v1'
    AND to_jsonb(contact) - ARRAY[
      'business_name', 'contact_name', 'email', 'phone', 'whatsapp', 'address',
      'organization_type', 'revealed_at', 'policy_version'
    ]::text[] = '{}'::jsonb,
  'Agency contact projection is not the exact approved Supplier allowlist'
)
FROM public.get_deal_counterparty_contact(
  '20000000-0000-0000-0000-000000000804'
) contact;
SELECT pg_temp.assert_denied(
  $$UPDATE public.deal_contact_reveals
    SET policy_version = 'tampered'
    WHERE deal_id = '20000000-0000-0000-0000-000000000804'$$,
  ARRAY['42501'],
  'Participant changed immutable contact reveal evidence'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('contact_reveal_agency_projection', 'pass');

SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.deal_contact_reveals
   WHERE deal_id = '20000000-0000-0000-0000-000000000804'
     AND accepted_offer_id = (
       SELECT value FROM deal_offer_fixture_context WHERE key = 'contact_reveal_offer'
     )
     AND reveal_trigger = 'offer_accepted'
     AND policy_version = 'deal-contact-v1') = 1
  AND (SELECT count(*) FROM public.admin_audit_logs
       WHERE action = 'deal.contact_revealed'
         AND (new_state->>'deal_id')::uuid = '20000000-0000-0000-0000-000000000804') = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_audit_logs
    WHERE action = 'deal.contact_revealed'
      AND new_state::text ~* '(supplier-business-one@example.test|\\+20000000001)'
  ),
  'Reveal uniqueness or PII-free audit evidence is invalid'
);
INSERT INTO deal_offer_fixture_results VALUES ('contact_reveal_atomic_idempotency', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_true(
  contact.business_name = 'Deal Fixture Agency One'
    AND contact.contact_name = 'Fixture Contact'
    AND contact.email = 'deal-contact@example.test'
    AND contact.phone = '+10000000000'
    AND contact.whatsapp = '+10000000001'
    AND contact.address = 'Fixture Address'
    AND contact.organization_type = 'agency',
  'Supplier contact projection does not use approved Agency business fields'
)
FROM public.get_deal_counterparty_contact(
  '20000000-0000-0000-0000-000000000804'
) contact;
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('contact_reveal_supplier_projection', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_two_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT * FROM public.get_deal_counterparty_contact(
      '20000000-0000-0000-0000-000000000804'
    )$$,
  ARRAY['42501'],
  'Unrelated Agency retrieved Deal contact'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'admin_user'),
  true
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.deal_contact_reveals
   WHERE deal_id = '20000000-0000-0000-0000-000000000804') = 1,
  'Platform Admin could not inspect non-PII reveal evidence'
);
SELECT pg_temp.assert_denied(
  $$SELECT * FROM public.get_deal_counterparty_contact(
      '20000000-0000-0000-0000-000000000804'
    )$$,
  ARRAY['42501'],
  'Platform Admin impersonated a Deal participant for contact retrieval'
);
RESET ROLE;

UPDATE public.organization_memberships
SET status = 'suspended'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_org');
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT * FROM public.get_deal_counterparty_contact(
      '20000000-0000-0000-0000-000000000804'
    )$$,
  ARRAY['42501'],
  'Inactive Supplier membership retained contact access'
);
RESET ROLE;
UPDATE public.organization_memberships
SET status = 'active'
WHERE user_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_user')
  AND organization_id = (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_org');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT pg_temp.assert_denied(
  $$SELECT * FROM public.get_deal_counterparty_contact(
      '20000000-0000-0000-0000-000000000804'
    )$$,
  ARRAY['42501'],
  'Anonymous caller retrieved Deal contact'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('contact_reveal_authority_boundaries', 'pass');

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.deal_contact_reveals
    WHERE deal_id = '20000000-0000-0000-0000-000000000801'
  ),
  'Cancelled pre-agreement Deal created reveal evidence'
);

INSERT INTO public.deals (
  id, buyer_organization_id, supplier_organization_id, created_by
)
SELECT
  '20000000-0000-0000-0000-000000000806',
  buyer.value,
  supplier.value,
  creator.value
FROM deal_offer_fixture_context buyer
JOIN deal_offer_fixture_context supplier ON supplier.key = 'supplier_one_org'
JOIN deal_offer_fixture_context creator ON creator.key = 'agency_one_user'
WHERE buyer.key = 'agency_one_org';
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
INSERT INTO deal_offer_fixture_context (key, value)
SELECT
  'failed_reveal_offer',
  (public.submit_initial_deal_offer(
    '20000000-0000-0000-0000-000000000806',
    9200,
    'SAR',
    now() + interval '10 days',
    'Withdrawn reveal fixture offer',
    '20000000-0000-0000-0000-000000000807'
  )->>'offer_id')::uuid;
SELECT public.withdraw_deal_offer(
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'failed_reveal_offer')
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_denied(
  $$SELECT public.accept_deal_offer(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'failed_reveal_offer')
    )$$,
  ARRAY['55000'],
  'Withdrawn Offer was accepted during reveal flow'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.deal_contact_reveals
    WHERE deal_id = '20000000-0000-0000-0000-000000000806'
  ),
  'Failed acceptance created reveal evidence'
);
INSERT INTO deal_offer_fixture_results VALUES ('contact_reveal_failure_rollback', 'pass');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.close_deal('20000000-0000-0000-0000-000000000804');
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.get_deal_counterparty_contact(
      '20000000-0000-0000-0000-000000000804'
    )
  ),
  'Closed agreed Deal did not retain contact access'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('contact_reveal_closed_retention', 'pass');

-- The evolved schema retains the V2 participant-based direct message contract.
INSERT INTO public.conversations (
  id, rfq_id, hotel_id, organizer_id, hotel_owner_id
)
SELECT
  '20000000-0000-0000-0000-000000000901',
  rfq.value,
  hotel.value,
  organizer.value,
  hotel_owner.value
FROM deal_offer_fixture_context rfq
JOIN deal_offer_fixture_context hotel ON hotel.key = 'hotel_one'
JOIN deal_offer_fixture_context organizer ON organizer.key = 'agency_one_user'
JOIN deal_offer_fixture_context hotel_owner ON hotel_owner.key = 'supplier_one_user'
WHERE rfq.key = 'rfq_one';
INSERT INTO public.conversation_participants (conversation_id, user_id, role)
VALUES
  (
    '20000000-0000-0000-0000-000000000901',
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
    'organizer'
  ),
  (
    '20000000-0000-0000-0000-000000000901',
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
    'hotel'
  );
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
INSERT INTO public.chat_messages (conversation_id, sender_id, body)
VALUES (
  '20000000-0000-0000-0000-000000000901',
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  'Legacy V2 message remains available'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.chat_messages
    WHERE conversation_id = '20000000-0000-0000-0000-000000000901'
      AND sender_organization_id IS NULL
      AND body = 'Legacy V2 message remains available'
  ),
  'Agency could not use the legacy V2 message contract'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.chat_messages
    WHERE conversation_id = '20000000-0000-0000-0000-000000000901'
      AND body = 'Legacy V2 message remains available'
  ),
  'Supplier could not read the legacy V2 message'
);
RESET ROLE;
INSERT INTO deal_offer_fixture_results VALUES ('deal_chat_v2_messaging_regression', 'pass');

-- Feature 7.5 authenticated activation journey. It starts from a legacy invitation and uses only
-- canonical V3 commands after Deal provisioning.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
WITH activation AS (
  SELECT public.ensure_deal_for_invitation(
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'invitation_activation')
  ) AS result
)
INSERT INTO deal_offer_fixture_context (key, value)
SELECT 'deal_activation', (result ->> 'deal_id')::uuid
FROM activation;
SELECT pg_temp.assert_true(
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_activation') =
    (
      SELECT (
        substr(digest, 1, 8) || '-' || substr(digest, 9, 4) || '-5' ||
        substr(digest, 14, 3) || '-8' || substr(digest, 18, 3) || '-' ||
        substr(digest, 21, 12)
      )::uuid
      FROM (
        SELECT md5(
          'grouptostay:v3:deal:invitation:' ||
          (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'invitation_activation')
        ) AS digest
      ) expected
    ),
  'Activation did not use the deterministic sourced Deal identity'
);
SELECT pg_temp.assert_true(
  (
    public.ensure_deal_for_invitation(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'invitation_activation')
    ) ->> 'deal_id'
  )::uuid = (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_activation'),
  'Supplier retry created or returned a different Deal'
);
WITH initial_offer AS (
  SELECT public.submit_initial_deal_offer(
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_activation'),
    150000,
    'SAR',
    now() + interval '7 days',
    'Activation journey initial offer',
    '20000000-0000-0000-0000-000000000991'
  ) AS result
)
INSERT INTO deal_offer_fixture_context (key, value)
SELECT 'activation_offer_one', (result ->> 'offer_id')::uuid
FROM initial_offer;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT pg_temp.assert_true(
  (
    public.ensure_deal_for_invitation(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'invitation_activation')
    ) ->> 'deal_id'
  )::uuid = (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_activation'),
  'Agency did not resolve the Supplier-provisioned Deal idempotently'
);
WITH agency_counter AS (
  SELECT public.counter_deal_offer(
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'activation_offer_one'),
    142000,
    'SAR',
    now() + interval '8 days',
    'Activation journey Agency counteroffer'
  ) AS result
)
INSERT INTO deal_offer_fixture_context (key, value)
SELECT 'activation_offer_two', (result ->> 'offer_id')::uuid
FROM agency_counter;
WITH conversation AS (
  SELECT public.ensure_deal_conversation(
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_activation')
  ) AS conversation_id
)
INSERT INTO deal_offer_fixture_context (key, value)
SELECT 'activation_conversation', conversation_id
FROM conversation;
SELECT public.send_deal_message(
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'activation_conversation'),
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'agency_one_org'),
  'Agency clarification in the activated Deal'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
WITH supplier_counter AS (
  SELECT public.counter_deal_offer(
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'activation_offer_two'),
    145000,
    'SAR',
    now() + interval '9 days',
    'Activation journey Supplier counteroffer'
  ) AS result
)
INSERT INTO deal_offer_fixture_context (key, value)
SELECT 'activation_offer_three', (result ->> 'offer_id')::uuid
FROM supplier_counter;
SELECT public.send_deal_message(
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'activation_conversation'),
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'supplier_one_org'),
  'Supplier clarification in the activated Deal'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'agency_one_user'),
  true
);
SELECT public.accept_deal_offer(
  (SELECT value FROM deal_offer_fixture_context WHERE key = 'activation_offer_three')
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.get_deal_counterparty_contact(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_activation')
    ) contact
    WHERE contact.organization_type = 'supplier'
      AND contact.business_name = 'Supplier Fixture Company One'
  ),
  'Agency did not receive the approved Supplier contact after agreement'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_one_user'),
  true
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.get_deal_counterparty_contact(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_activation')
    ) contact
    WHERE contact.organization_type = 'agency'
      AND contact.business_name = 'Deal Fixture Agency One'
  ),
  'Supplier did not receive the approved Agency contact after agreement'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'supplier_two_user'),
  true
);
SELECT pg_temp.assert_forbidden(
  $$SELECT public.ensure_deal_for_invitation(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'invitation_activation')
    )$$,
  'Unrelated Supplier activated another invitation'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'admin_user'),
  true
);
SELECT pg_temp.assert_forbidden(
  $$SELECT public.ensure_deal_for_invitation(
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'invitation_activation')
    )$$,
  'Platform Admin impersonated a marketplace participant during Deal activation'
);
RESET ROLE;

SELECT pg_temp.assert_true(
  (
    SELECT count(*)
    FROM public.deals
    WHERE source_invitation_id =
      (SELECT value FROM deal_offer_fixture_context WHERE key = 'invitation_activation')
  ) = 1,
  'Activation created duplicate Deals for one invitation'
);
SELECT pg_temp.assert_true(
  (
    SELECT count(*)
    FROM public.admin_audit_logs
    WHERE action = 'deal.activated_from_invitation'
      AND entity_id =
        (SELECT value::text FROM deal_offer_fixture_context WHERE key = 'deal_activation')
  ) = 1,
  'Deal activation audit evidence is missing or duplicated'
);
SELECT pg_temp.assert_true(
  (SELECT status FROM public.deals WHERE id =
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_activation')) = 'agreed'
  AND (SELECT count(*) FROM public.offers WHERE deal_id =
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_activation')) = 3
  AND (SELECT count(*) FROM public.deal_contact_reveals WHERE deal_id =
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'deal_activation')) = 1
  AND (SELECT count(*) FROM public.chat_messages WHERE conversation_id =
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'activation_conversation')) = 2,
  'Activated Deal did not complete Offer, Chat, agreement, and reveal journey'
);
SELECT pg_temp.assert_true(
  (SELECT status FROM public.rfq_invitations WHERE id =
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'invitation_activation')) = 'pending'
  AND (SELECT count(*) FROM public.quotes WHERE rfq_id =
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'rfq_activation')) = 0
  AND (SELECT count(*) FROM public.bookings WHERE rfq_id =
    (SELECT value FROM deal_offer_fixture_context WHERE key = 'rfq_activation')) = 0,
  'V2 invitation, quotation, or booking state changed during Deal activation journey'
);
INSERT INTO deal_offer_fixture_results VALUES ('deal_activation_idempotency_authority', 'pass');
INSERT INTO deal_offer_fixture_results VALUES ('deal_activation_authenticated_end_to_end', 'pass');

SELECT json_agg(
  json_build_object('fixture', fixture, 'result', result)
  ORDER BY fixture
)::text
FROM deal_offer_fixture_results;

ROLLBACK;
