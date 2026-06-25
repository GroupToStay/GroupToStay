
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

-- Make budget fields fully optional (already nullable; keep existing data)
-- no-op

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
