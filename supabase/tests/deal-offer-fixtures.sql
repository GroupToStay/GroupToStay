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
GRANT SELECT ON deal_offer_fixture_context TO authenticated;

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
  _invitation_one uuid := '20000000-0000-0000-0000-000000000301';
  _invitation_two uuid := '20000000-0000-0000-0000-000000000302';
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
      agency_type = 'travel',
      annual_group_bookings = '10',
      avg_rooms_per_booking = '5',
      legal_billing_name = 'Deal Fixture Agency',
      vat_billing_number = 'DEAL-FIXTURE-VAT',
      billing_address = 'Fixture Address',
      billing_email = 'deal-billing@example.test',
      legal_agreements_accepted_at = now()
  WHERE id IN (_agency_one, _agency_two);

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
    );

  INSERT INTO public.rfq_invitations (id, rfq_id, hotel_id)
  VALUES
    (_invitation_one, _rfq_one, _hotel_one),
    (_invitation_two, _rfq_two, _hotel_two);

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
    ('invitation_one', _invitation_one),
    ('invitation_two', _invitation_two),
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

SELECT json_agg(
  json_build_object('fixture', fixture, 'result', result)
  ORDER BY fixture
)::text
FROM deal_offer_fixture_results;

ROLLBACK;
