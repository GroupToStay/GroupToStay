
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
