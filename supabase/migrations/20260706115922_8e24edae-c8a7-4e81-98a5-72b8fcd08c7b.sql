
-- 1) Fix admin role signup bypass in handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _requested_role text := NULLIF(NEW.raw_user_meta_data->>'role','');
  _role public.app_role := CASE
    WHEN _requested_role = 'hotel' THEN 'hotel'::public.app_role
    ELSE 'organizer'::public.app_role
  END;
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

-- 2) Chat attachments MIME + size restriction
DROP POLICY IF EXISTS "chat_attachments_mime_and_size" ON storage.objects;
CREATE POLICY "chat_attachments_mime_and_size"
ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id <> 'chat-attachments'
  OR (
    (metadata->>'mimetype') IN (
      'image/jpeg','image/png','image/gif','image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    )
    AND COALESCE((metadata->>'size')::bigint, 0) <= 10485760
  )
);

-- 3) Hotel photos MIME + size restriction
DROP POLICY IF EXISTS "hotel_photos_mime_and_size" ON storage.objects;
CREATE POLICY "hotel_photos_mime_and_size"
ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id <> 'hotel-photos'
  OR (
    (metadata->>'mimetype') IN ('image/jpeg','image/png','image/webp','image/gif')
    AND COALESCE((metadata->>'size')::bigint, 0) <= 10485760
  )
);
