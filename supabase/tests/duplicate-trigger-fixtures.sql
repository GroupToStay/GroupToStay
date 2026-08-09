-- Runs only inside the disposable reconstruction database. Every fixture row and temporary
-- trigger state change is rolled back before psql exits.
BEGIN;

CREATE TEMP TABLE fixture_results (
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

DO $$
DECLARE
  organizer_id uuid := '00000000-0000-0000-0000-000000000101';
  draft_organizer_id uuid := '00000000-0000-0000-0000-000000000102';
  hotel_owner_id uuid := '00000000-0000-0000-0000-000000000103';
  admin_id uuid := '00000000-0000-0000-0000-000000000104';
  country_id uuid;
  city_id uuid;
  hotel_id uuid := '00000000-0000-0000-0000-000000000201';
  base_rfq_id uuid := '00000000-0000-0000-0000-000000000301';
  conversation_rfq_id uuid := '00000000-0000-0000-0000-000000000309';
  quote_id uuid := '00000000-0000-0000-0000-000000000401';
  booking_id uuid := '00000000-0000-0000-0000-000000000501';
  before_events bigint;
  after_events bigint;
  before_notifications bigint;
  after_notifications bigint;
  failed boolean;
  failure_state text;
  failure_message text;
  final_amount numeric;
BEGIN
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (organizer_id, 'authenticated', 'authenticated', 'fixture-organizer@example.test', '', '{}'::jsonb, '{"role":"organizer"}'::jsonb, now(), now()),
    (draft_organizer_id, 'authenticated', 'authenticated', 'fixture-draft@example.test', '', '{}'::jsonb, '{"role":"organizer"}'::jsonb, now(), now()),
    (hotel_owner_id, 'authenticated', 'authenticated', 'fixture-hotel@example.test', '', '{}'::jsonb, '{"role":"hotel"}'::jsonb, now(), now()),
    (admin_id, 'authenticated', 'authenticated', 'fixture-admin@example.test', '', '{}'::jsonb, '{"role":"organizer"}'::jsonb, now(), now());

  DELETE FROM public.organization_memberships WHERE user_id = admin_id;
  DELETE FROM public.organizations WHERE legacy_owner_user_id = admin_id;
  DELETE FROM public.user_roles WHERE user_id = admin_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_id, 'admin');
  PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
  UPDATE public.profiles
  SET agency_verification_status = 'verified',
      legal_company_name = 'Fixture Agency',
      country = 'Fixture Country',
      country_id = (SELECT id FROM public.countries ORDER BY code LIMIT 1),
      city_id = (SELECT city.id FROM public.cities city JOIN public.countries country ON country.id = city.country_id ORDER BY country.code, city.name_en LIMIT 1),
      full_address = 'Fixture Address',
      cr_number = 'FIXTURE-CR',
      cr_expiry_date = current_date + 365,
      issuing_authority = 'Fixture Authority',
      cr_document_path = 'fixture/cr.pdf',
      contact_person_name = 'Fixture Contact',
      contact_person_position = 'Manager',
      contact_person_email = 'fixture-contact@example.test',
      contact_person_phone = '+10000000000',
      agency_type = 'travel',
      annual_group_bookings = '10',
      avg_rooms_per_booking = '5',
      legal_billing_name = 'Fixture Agency',
      vat_billing_number = 'FIXTURE-VAT',
      billing_address = 'Fixture Address',
      billing_email = 'fixture-billing@example.test',
      legal_agreements_accepted_at = now()
  WHERE id = organizer_id;
  UPDATE public.profiles SET agency_verification_status = 'draft' WHERE id = draft_organizer_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (organizer_id, 'organizer'), (draft_organizer_id, 'organizer'), (hotel_owner_id, 'hotel')
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT country.id, city.id
  INTO country_id, city_id
  FROM public.countries country
  JOIN public.cities city ON city.country_id = country.id
  ORDER BY country.code, city.name_en
  LIMIT 1;
  PERFORM pg_temp.assert_true(country_id IS NOT NULL AND city_id IS NOT NULL, 'fixture geography missing');

  INSERT INTO public.hotels (id, owner_id, name, slug, city, country, address, status)
  VALUES (hotel_id, hotel_owner_id, 'Fixture Hotel', 'fixture-hotel', 'Fixture City', 'Fixture Country', 'Fixture Address', 'approved');

  INSERT INTO public.rfqs (
    id, organizer_id, title, destination_city, destination_country, destination_country_id,
    destination_city_id, check_in, check_out, guests_count, rooms_needed
  ) VALUES (
    base_rfq_id, organizer_id, 'Fixture valid request', 'Fixture City', 'Fixture Country', country_id,
    city_id, current_date + 20, current_date + 22, 10, 5
  );
  INSERT INTO public.rfqs (
    id, organizer_id, title, destination_city, destination_country, destination_country_id,
    destination_city_id, check_in, check_out, guests_count, rooms_needed
  ) VALUES (
    conversation_rfq_id, organizer_id, 'Fixture conversation request', 'Fixture City', 'Fixture Country', country_id,
    city_id, current_date + 23, current_date + 25, 10, 5
  );
  INSERT INTO public.quotes (id, rfq_id, hotel_id, total_price, price_per_room_night, valid_until)
  VALUES (quote_id, base_rfq_id, hotel_id, 1000, 100, current_date + 10);
  INSERT INTO public.bookings (id, rfq_id, quote_id, organizer_id, hotel_id, total_amount, commission_amount)
  VALUES (booking_id, base_rfq_id, quote_id, organizer_id, hotel_id, 1000, 100);

  -- Booking: an organizer may change status, but may not change commercial fields.
  PERFORM set_config('request.jwt.claim.sub', organizer_id::text, true);
  SELECT count(*) INTO before_events FROM public.rfq_lifecycle_events;
  SELECT count(*) INTO before_notifications FROM public.notifications;
  UPDATE public.bookings SET status = 'cancelled' WHERE id = booking_id;
  SELECT count(*) INTO after_events FROM public.rfq_lifecycle_events;
  SELECT count(*) INTO after_notifications FROM public.notifications;
  PERFORM pg_temp.assert_true(after_events = before_events AND after_notifications = before_notifications, 'booking guard created a side effect');

  failed := false;
  BEGIN
    UPDATE public.bookings SET total_amount = 2000 WHERE id = booking_id;
  EXCEPTION WHEN OTHERS THEN
    failed := true; failure_state := SQLSTATE; failure_message := SQLERRM;
  END;
  SELECT total_amount INTO final_amount FROM public.bookings WHERE id = booking_id;
  PERFORM pg_temp.assert_true(failed AND failure_state = 'P0001' AND failure_message = 'Organizers may only update booking status' AND final_amount = 1000, 'booking duplicate denial changed');
  INSERT INTO fixture_results VALUES ('booking_with_duplicates', 'pass');

  ALTER TABLE public.bookings DISABLE TRIGGER restrict_organizer_booking_updates_trg;
  UPDATE public.bookings SET status = 'completed' WHERE id = booking_id;
  failed := false;
  BEGIN
    UPDATE public.bookings SET total_amount = 3000 WHERE id = booking_id;
  EXCEPTION WHEN OTHERS THEN
    failed := true; failure_state := SQLSTATE; failure_message := SQLERRM;
  END;
  SELECT total_amount INTO final_amount FROM public.bookings WHERE id = booking_id;
  PERFORM pg_temp.assert_true(failed AND failure_state = 'P0001' AND failure_message = 'Organizers may only update booking status' AND final_amount = 1000, 'booking survivor denial changed');
  INSERT INTO fixture_results VALUES ('booking_with_survivor', 'pass');

  -- Conversation: verified agency permits insert; draft agency is denied identically.
  SELECT count(*) INTO before_events FROM public.rfq_lifecycle_events;
  SELECT count(*) INTO before_notifications FROM public.notifications;
  INSERT INTO public.conversations (rfq_id, quote_id, hotel_id, organizer_id, hotel_owner_id)
  VALUES (conversation_rfq_id, null, hotel_id, organizer_id, hotel_owner_id);
  SELECT count(*) INTO after_events FROM public.rfq_lifecycle_events;
  SELECT count(*) INTO after_notifications FROM public.notifications;
  PERFORM pg_temp.assert_true(after_events = before_events AND after_notifications = before_notifications, 'conversation guard created a side effect');
  failed := false;
  BEGIN
    INSERT INTO public.conversations (rfq_id, hotel_id, organizer_id, hotel_owner_id)
    VALUES ('00000000-0000-0000-0000-000000000302', hotel_id, draft_organizer_id, hotel_owner_id);
  EXCEPTION WHEN OTHERS THEN
    failed := true; failure_state := SQLSTATE; failure_message := SQLERRM;
  END;
  PERFORM pg_temp.assert_true(failed AND failure_state = 'P0001' AND failure_message = 'Agency must be verified to contact hotels', 'conversation duplicate denial changed');
  INSERT INTO fixture_results VALUES ('conversation_with_duplicates', 'pass');

  ALTER TABLE public.conversations DISABLE TRIGGER trg_require_verified_agency_for_conversation;
  failed := false;
  BEGIN
    INSERT INTO public.conversations (rfq_id, hotel_id, organizer_id, hotel_owner_id)
    VALUES ('00000000-0000-0000-0000-000000000303', hotel_id, draft_organizer_id, hotel_owner_id);
  EXCEPTION WHEN OTHERS THEN
    failed := true; failure_state := SQLSTATE; failure_message := SQLERRM;
  END;
  PERFORM pg_temp.assert_true(failed AND failure_state = 'P0001' AND failure_message = 'Agency must be verified to contact hotels', 'conversation survivor denial changed');
  INSERT INTO fixture_results VALUES ('conversation_with_survivor', 'pass');

  -- RFQ verification and row validation: check successful insert, verification denial, and validation denial.
  SELECT count(*) INTO before_events FROM public.rfq_lifecycle_events;
  INSERT INTO public.rfqs (id, organizer_id, title, destination_city, destination_country, destination_country_id, destination_city_id, check_in, check_out, guests_count, rooms_needed)
  VALUES ('00000000-0000-0000-0000-000000000304', organizer_id, 'Fixture verified request', 'Fixture City', 'Fixture Country', country_id, city_id, current_date + 25, current_date + 27, 12, 6);
  SELECT count(*) INTO after_events FROM public.rfq_lifecycle_events;
  PERFORM pg_temp.assert_true(after_events = before_events + 1, 'rfq duplicate guards changed lifecycle event count');
  failed := false;
  BEGIN
    INSERT INTO public.rfqs (id, organizer_id, title, destination_city, destination_country, destination_country_id, destination_city_id, check_in, check_out, guests_count, rooms_needed)
    VALUES ('00000000-0000-0000-0000-000000000305', draft_organizer_id, 'Fixture draft request', 'Fixture City', 'Fixture Country', country_id, city_id, current_date + 25, current_date + 27, 12, 6);
  EXCEPTION WHEN OTHERS THEN
    failed := true; failure_state := SQLSTATE; failure_message := SQLERRM;
  END;
  PERFORM pg_temp.assert_true(failed AND failure_state = 'P0001' AND failure_message = 'Agency verification and all required profile information must be complete before creating requests', 'rfq verification duplicate denial changed');
  failed := false;
  BEGIN
    INSERT INTO public.rfqs (id, organizer_id, title, destination_city, destination_country, destination_country_id, destination_city_id, check_in, check_out, guests_count, rooms_needed)
    VALUES ('00000000-0000-0000-0000-000000000306', organizer_id, 'x', 'Fixture City', 'Fixture Country', country_id, city_id, current_date + 25, current_date + 27, 12, 6);
  EXCEPTION WHEN OTHERS THEN
    failed := true; failure_state := SQLSTATE; failure_message := SQLERRM;
  END;
  PERFORM pg_temp.assert_true(failed AND failure_state = 'P0001' AND failure_message = 'Request title must be at least 3 characters', 'rfq validation duplicate denial changed');
  INSERT INTO fixture_results VALUES ('rfq_with_duplicates', 'pass');

  ALTER TABLE public.rfqs DISABLE TRIGGER trg_require_verified_agency_for_rfq;
  ALTER TABLE public.rfqs DISABLE TRIGGER validate_rfq_row_trg;
  failed := false;
  BEGIN
    INSERT INTO public.rfqs (id, organizer_id, title, destination_city, destination_country, destination_country_id, destination_city_id, check_in, check_out, guests_count, rooms_needed)
    VALUES ('00000000-0000-0000-0000-000000000307', draft_organizer_id, 'Fixture draft request', 'Fixture City', 'Fixture Country', country_id, city_id, current_date + 25, current_date + 27, 12, 6);
  EXCEPTION WHEN OTHERS THEN
    failed := true; failure_state := SQLSTATE; failure_message := SQLERRM;
  END;
  PERFORM pg_temp.assert_true(failed AND failure_state = 'P0001' AND failure_message = 'Agency verification and all required profile information must be complete before creating requests', 'rfq verification survivor denial changed');
  failed := false;
  BEGIN
    INSERT INTO public.rfqs (id, organizer_id, title, destination_city, destination_country, destination_country_id, destination_city_id, check_in, check_out, guests_count, rooms_needed)
    VALUES ('00000000-0000-0000-0000-000000000308', organizer_id, 'x', 'Fixture City', 'Fixture Country', country_id, city_id, current_date + 25, current_date + 27, 12, 6);
  EXCEPTION WHEN OTHERS THEN
    failed := true; failure_state := SQLSTATE; failure_message := SQLERRM;
  END;
  PERFORM pg_temp.assert_true(failed AND failure_state = 'P0001' AND failure_message = 'Request title must be at least 3 characters', 'rfq validation survivor denial changed');
  INSERT INTO fixture_results VALUES ('rfq_with_survivors', 'pass');
END;
$$;

SELECT json_agg(json_build_object('fixture', fixture, 'result', result) ORDER BY fixture)::text
FROM fixture_results;

ROLLBACK;
