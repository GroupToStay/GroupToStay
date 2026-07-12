
-- 1) Hotels: stop exposing owner_id to anon. Replace public anon policy with an authenticated-only policy, and create a public view that excludes owner_id for anon browsing.
DROP POLICY IF EXISTS "Approved hotels public" ON public.hotels;

CREATE POLICY "Approved hotels visible to authenticated"
ON public.hotels FOR SELECT
TO authenticated
USING (status = 'approved'::hotel_status);

CREATE OR REPLACE VIEW public.hotels_public AS
SELECT id, name, slug, city, country, address, lat, lng, star_rating,
       description, amenities, cover_image, gallery, status, featured,
       created_at, updated_at, country_id, city_id, hotel_type_id, archived
FROM public.hotels
WHERE status = 'approved'::hotel_status AND archived IS NOT TRUE;

GRANT SELECT ON public.hotels_public TO anon, authenticated;

-- 2) Conversations: explicit deny for client INSERTs (server trigger create_conversation_for_quote runs SECURITY DEFINER and bypasses RLS).
CREATE POLICY "Conversations created server-side only"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (false);

-- 3) Subscription interest: require user_id = auth.uid() so submissions cannot be orphaned.
DROP POLICY IF EXISTS "Users insert own interest" ON public.subscription_interest;
CREATE POLICY "Users insert own interest"
ON public.subscription_interest FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Make the public view run with the caller's permissions (security_invoker)
ALTER VIEW public.hotels_public SET (security_invoker = on);

-- Restore the public read of approved hotels (needed by the view under security_invoker)
CREATE POLICY "Approved hotels public"
ON public.hotels FOR SELECT
TO anon, authenticated
USING (status = 'approved'::hotel_status);

-- Remove the duplicate authenticated-only policy added in the previous migration
DROP POLICY IF EXISTS "Approved hotels visible to authenticated" ON public.hotels;

-- Stop anonymous visitors from reading owner_id on the base table.
-- Authenticated owners/admins keep full access via their own policies.
REVOKE SELECT ON public.hotels FROM anon;
GRANT SELECT (id, name, slug, city, country, address, lat, lng, star_rating,
              description, amenities, cover_image, gallery, status, featured,
              created_at, updated_at, country_id, city_id, hotel_type_id, archived)
ON public.hotels TO anon;

-- Trigger-only / internal SECURITY DEFINER functions: revoke direct EXECUTE from all roles.
-- They continue to run from triggers under the function owner's privileges.
DO $$
DECLARE
  fn text;
  trigger_only text[] := ARRAY[
    'public.handle_new_user()',
    'public.update_updated_at_column()',
    'public.match_hotel_to_rfqs()',
    'public.match_rfq_to_hotels()',
    'public.restrict_organizer_quote_updates()',
    'public.restrict_profile_company_fields()',
    'public.restrict_organizer_booking_updates()',
    'public.prevent_profile_approval_self_update()',
    'public.enforce_admin_exclusive_role()',
    'public.create_conversation_for_quote()',
    'public.bump_conversation_last_message()',
    'public.lock_company_approval()',
    'public.lock_hotel_approval()',
    'public.notify_hotel_on_invitation()',
    'public.notify_organizer_on_quote()',
    'public.notify_hotel_on_quote_status()',
    'public.notify_hotel_on_status_change()',
    'public.notify_company_on_status_change()',
    'public.notify_on_new_message()',
    'public.create_notification(uuid, public.notification_type, text, text, text, jsonb)',
    'public._norm(text)'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_only LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;

-- RLS helper functions: lock down to `authenticated` only (used inside policy expressions).
DO $$
DECLARE
  fn text;
  rls_helpers text[] := ARRAY[
    'public.has_role(uuid, public.app_role)',
    'public.is_rfq_organizer(uuid, uuid)',
    'public.is_hotel_invited_to_rfq(uuid, uuid)',
    'public.is_conversation_participant(uuid, uuid)',
    'public.is_hotel_profile_approved(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY rls_helpers LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pms_enabled boolean,
  ADD COLUMN IF NOT EXISTS pms_provider text,
  ADD COLUMN IF NOT EXISTS pms_provider_other text,
  ADD COLUMN IF NOT EXISTS api_available text,
  ADD COLUMN IF NOT EXISTS technical_contact_name text,
  ADD COLUMN IF NOT EXISTS technical_contact_email text,
  ADD COLUMN IF NOT EXISTS technical_contact_phone text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_api_available_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_api_available_check
  CHECK (api_available IS NULL OR api_available IN ('Yes','No','Not Sure'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'organizer');
  _country_id uuid;
  _country_text text := NULLIF(NEW.raw_user_meta_data->>'country_id', '');
  _pms_enabled_text text := NULLIF(NEW.raw_user_meta_data->>'pms_enabled','');
  _pms_enabled boolean := CASE WHEN _pms_enabled_text IS NULL THEN NULL WHEN _pms_enabled_text IN ('true','t','1','yes') THEN true ELSE false END;
  _api_available text := NULLIF(NEW.raw_user_meta_data->>'api_available','');
BEGIN
  IF _country_text IS NOT NULL THEN
    IF _country_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      _country_id := _country_text::uuid;
    ELSE
      SELECT c.id INTO _country_id
      FROM public.countries c
      WHERE upper(c.code) = upper(_country_text)
         OR lower(c.name_en) = lower(_country_text)
      LIMIT 1;
    END IF;
  END IF;

  IF _api_available IS NOT NULL AND _api_available NOT IN ('Yes','No','Not Sure') THEN
    _api_available := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, full_name, org_name, phone, country, locale,
    country_code, phone_number, country_id,
    company_name, vat_number, cr_number, contact_email,
    id_type, id_number, hotel_approval_status,
    pms_enabled, pms_provider, pms_provider_other, api_available,
    technical_contact_name, technical_contact_email, technical_contact_phone
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'org_name',
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'country', (SELECT c.name_en FROM public.countries c WHERE c.id = _country_id), _country_text),
    COALESCE(NEW.raw_user_meta_data->>'locale','en'),
    NEW.raw_user_meta_data->>'country_code',
    NEW.raw_user_meta_data->>'phone_number',
    _country_id,
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'vat_number',
    NEW.raw_user_meta_data->>'cr_number',
    COALESCE(NEW.raw_user_meta_data->>'contact_email', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'id_type','')::public.id_doc_type,
    NEW.raw_user_meta_data->>'id_number',
    CASE WHEN _role = 'hotel' THEN 'pending'::public.hotel_approval_status ELSE NULL END,
    _pms_enabled,
    NULLIF(NEW.raw_user_meta_data->>'pms_provider',''),
    NULLIF(NEW.raw_user_meta_data->>'pms_provider_other',''),
    _api_available,
    NULLIF(NEW.raw_user_meta_data->>'technical_contact_name',''),
    NULLIF(NEW.raw_user_meta_data->>'technical_contact_email',''),
    NULLIF(NEW.raw_user_meta_data->>'technical_contact_phone','')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$function$;

-- Extend enums
ALTER TYPE public.rfq_status ADD VALUE IF NOT EXISTS 'quoting';
ALTER TYPE public.rfq_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'viewed';

-- Profile additions (agency)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agency_type text,
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS website text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_agency_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_agency_type_check CHECK (
    agency_type IS NULL OR agency_type IN
    ('umrah','hajj','travel','tour_operator','corporate','event','sports','school','government','other')
  );

-- RFQ additions
ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS hotel_categories int[],
  ADD COLUMN IF NOT EXISTS accommodation_type text,
  ADD COLUMN IF NOT EXISTS meal_plan_code text,
  ADD COLUMN IF NOT EXISTS additional_requirements text;

ALTER TABLE public.rfqs
  DROP CONSTRAINT IF EXISTS rfqs_accommodation_type_check;
ALTER TABLE public.rfqs
  ADD CONSTRAINT rfqs_accommodation_type_check CHECK (
    accommodation_type IS NULL OR accommodation_type IN ('hotel','hotel_apartment','resort','any')
  );

ALTER TABLE public.rfqs
  DROP CONSTRAINT IF EXISTS rfqs_meal_plan_code_check;
ALTER TABLE public.rfqs
  ADD CONSTRAINT rfqs_meal_plan_code_check CHECK (
    meal_plan_code IS NULL OR meal_plan_code IN ('room_only','bb','hb','fb')
  );

-- Quotes enrichment
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS shortlisted_at timestamptz,
  ADD COLUMN IF NOT EXISTS room_type text,
  ADD COLUMN IF NOT EXISTS included_services text[];

-- Extend handle_new_user to capture agency fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'organizer');
  _country_id uuid;
  _country_text text := NULLIF(NEW.raw_user_meta_data->>'country_id', '');
  _pms_enabled_text text := NULLIF(NEW.raw_user_meta_data->>'pms_enabled','');
  _pms_enabled boolean := CASE WHEN _pms_enabled_text IS NULL THEN NULL WHEN _pms_enabled_text IN ('true','t','1','yes') THEN true ELSE false END;
  _api_available text := NULLIF(NEW.raw_user_meta_data->>'api_available','');
  _agency_type text := NULLIF(NEW.raw_user_meta_data->>'agency_type','');
BEGIN
  IF _country_text IS NOT NULL THEN
    IF _country_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      _country_id := _country_text::uuid;
    ELSE
      SELECT c.id INTO _country_id
      FROM public.countries c
      WHERE upper(c.code) = upper(_country_text)
         OR lower(c.name_en) = lower(_country_text)
      LIMIT 1;
    END IF;
  END IF;

  IF _api_available IS NOT NULL AND _api_available NOT IN ('Yes','No','Not Sure') THEN
    _api_available := NULL;
  END IF;

  IF _agency_type IS NOT NULL AND _agency_type NOT IN
    ('umrah','hajj','travel','tour_operator','corporate','event','sports','school','government','other') THEN
    _agency_type := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, full_name, org_name, phone, country, locale,
    country_code, phone_number, country_id,
    company_name, vat_number, cr_number, contact_email,
    id_type, id_number, hotel_approval_status,
    pms_enabled, pms_provider, pms_provider_other, api_available,
    technical_contact_name, technical_contact_email, technical_contact_phone,
    agency_type, business_address, website
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'org_name',
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'country', (SELECT c.name_en FROM public.countries c WHERE c.id = _country_id), _country_text),
    COALESCE(NEW.raw_user_meta_data->>'locale','en'),
    NEW.raw_user_meta_data->>'country_code',
    NEW.raw_user_meta_data->>'phone_number',
    _country_id,
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'vat_number',
    NEW.raw_user_meta_data->>'cr_number',
    COALESCE(NEW.raw_user_meta_data->>'contact_email', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'id_type','')::public.id_doc_type,
    NEW.raw_user_meta_data->>'id_number',
    CASE WHEN _role = 'hotel' THEN 'pending'::public.hotel_approval_status ELSE NULL END,
    _pms_enabled,
    NULLIF(NEW.raw_user_meta_data->>'pms_provider',''),
    NULLIF(NEW.raw_user_meta_data->>'pms_provider_other',''),
    _api_available,
    NULLIF(NEW.raw_user_meta_data->>'technical_contact_name',''),
    NULLIF(NEW.raw_user_meta_data->>'technical_contact_email',''),
    NULLIF(NEW.raw_user_meta_data->>'technical_contact_phone',''),
    _agency_type,
    NULLIF(NEW.raw_user_meta_data->>'business_address',''),
    NULLIF(NEW.raw_user_meta_data->>'website','')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$function$;

-- When a quote is created, bump RFQ to 'quoting' (if currently 'open')
CREATE OR REPLACE FUNCTION public.bump_rfq_to_quoting()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.rfqs
     SET status = 'quoting'
   WHERE id = NEW.rfq_id AND status = 'open';
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_rfq_to_quoting() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bump_rfq_to_quoting ON public.quotes;
CREATE TRIGGER trg_bump_rfq_to_quoting
AFTER INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.bump_rfq_to_quoting();
