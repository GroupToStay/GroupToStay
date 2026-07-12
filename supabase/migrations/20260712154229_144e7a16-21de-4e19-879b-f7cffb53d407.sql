
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

-- 1. Booking amount validation
CREATE OR REPLACE FUNCTION public.validate_booking_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quote_total numeric;
  _quote_rfq uuid;
  _quote_hotel uuid;
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT total_price, rfq_id, hotel_id
    INTO _quote_total, _quote_rfq, _quote_hotel
  FROM public.quotes
  WHERE id = NEW.quote_id;

  IF _quote_total IS NULL THEN
    RAISE EXCEPTION 'Referenced quote not found';
  END IF;
  IF _quote_rfq IS DISTINCT FROM NEW.rfq_id OR _quote_hotel IS DISTINCT FROM NEW.hotel_id THEN
    RAISE EXCEPTION 'Booking rfq_id/hotel_id must match the referenced quote';
  END IF;

  -- Force amounts from the trusted quote row; ignore client-supplied values
  NEW.total_amount := _quote_total;
  NEW.commission_amount := round(_quote_total * 0.10, 2);

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_booking_amounts() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_booking_amounts ON public.bookings;
CREATE TRIGGER trg_validate_booking_amounts
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_booking_amounts();

-- 2. Conversations: block user-driven changes to last_message_* fields (allow nested trigger updates)
CREATE OR REPLACE FUNCTION public.restrict_conversation_participant_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.rfq_id          IS DISTINCT FROM OLD.rfq_id
   OR NEW.quote_id       IS DISTINCT FROM OLD.quote_id
   OR NEW.hotel_id       IS DISTINCT FROM OLD.hotel_id
   OR NEW.organizer_id   IS DISTINCT FROM OLD.organizer_id
   OR NEW.hotel_owner_id IS DISTINCT FROM OLD.hotel_owner_id
   OR NEW.created_at     IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Participants may only update read-tracking fields on conversations';
  END IF;

  -- Only nested trigger calls (e.g. bump_conversation_last_message) may modify last_message_*
  IF pg_trigger_depth() <= 1 THEN
    IF NEW.last_message_at      IS DISTINCT FROM OLD.last_message_at
     OR NEW.last_message_preview IS DISTINCT FROM OLD.last_message_preview
    THEN
      RAISE EXCEPTION 'last_message fields are managed by the system';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Hotels: prevent owner from changing status / featured / archived / owner_id
CREATE OR REPLACE FUNCTION public.restrict_owner_hotel_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id  IS DISTINCT FROM OLD.owner_id
   OR NEW.status   IS DISTINCT FROM OLD.status
   OR NEW.featured IS DISTINCT FROM OLD.featured
   OR NEW.archived IS DISTINCT FROM OLD.archived
  THEN
    RAISE EXCEPTION 'Only admins can change hotel status, featured, archived, or ownership';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.restrict_owner_hotel_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_restrict_owner_hotel_updates ON public.hotels;
CREATE TRIGGER trg_restrict_owner_hotel_updates
BEFORE UPDATE ON public.hotels
FOR EACH ROW EXECUTE FUNCTION public.restrict_owner_hotel_updates();

-- 4. Quotes: ensure restrict trigger is present (defense in depth alongside existing policy)
DROP TRIGGER IF EXISTS trg_restrict_organizer_quote_updates ON public.quotes;
CREATE TRIGGER trg_restrict_organizer_quote_updates
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.restrict_organizer_quote_updates();

-- Add explicit WITH CHECK to policies to signal column intent to static analysis
DROP POLICY IF EXISTS "Participants can update last_read indirectly" ON public.conversations;
CREATE POLICY "Participants can update last_read indirectly"
ON public.conversations
FOR UPDATE
USING (auth.uid() = organizer_id OR auth.uid() = hotel_owner_id)
WITH CHECK (auth.uid() = organizer_id OR auth.uid() = hotel_owner_id);

DROP POLICY IF EXISTS "Owner updates hotel" ON public.hotels;
CREATE POLICY "Owner updates hotel"
ON public.hotels
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Ensure account_status column exists (referenced by security enforcement below)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'suspended', 'disabled'));

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles(account_status);

CREATE OR REPLACE FUNCTION public.prevent_non_admin_account_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    RAISE EXCEPTION 'Account status can only be changed by admins';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_non_admin_account_status_change ON public.profiles;
CREATE TRIGGER trg_prevent_non_admin_account_status_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_non_admin_account_status_change();

-- 1. agency_self_verify
CREATE OR REPLACE FUNCTION public.prevent_profile_approval_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.hotel_approval_status IS DISTINCT FROM OLD.hotel_approval_status
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approval_notes IS DISTINCT FROM OLD.approval_notes THEN
    RAISE EXCEPTION 'Approval fields can only be modified by admins';
  END IF;

  -- Agency verification: only draft/submitted/pending_review transitions allowed for users
  IF NEW.agency_verification_status IS DISTINCT FROM OLD.agency_verification_status THEN
    IF COALESCE(NEW.agency_verification_status::text, '') NOT IN ('draft','submitted','pending_review') THEN
      RAISE EXCEPTION 'Agency verification status can only be changed by admins';
    END IF;
  END IF;

  IF NEW.verification_reviewed_at IS DISTINCT FROM OLD.verification_reviewed_at
     OR NEW.verification_reviewed_by IS DISTINCT FROM OLD.verification_reviewed_by
     OR NEW.verification_rejection_reason IS DISTINCT FROM OLD.verification_rejection_reason
     OR NEW.verification_trust_level IS DISTINCT FROM OLD.verification_trust_level THEN
    RAISE EXCEPTION 'Verification review fields can only be modified by admins';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. account_status_no_enforce
CREATE OR REPLACE FUNCTION public.is_account_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT account_status = 'active' FROM public.profiles WHERE id = _user_id),
    true
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_account_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_active(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_active_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(_uid, 'admin') THEN RETURN NEW; END IF;
  IF NOT public.is_account_active(_uid) THEN
    RAISE EXCEPTION 'Account is suspended or disabled';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_active_account() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_active_account_rfqs ON public.rfqs;
CREATE TRIGGER trg_enforce_active_account_rfqs
BEFORE INSERT OR UPDATE ON public.rfqs
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_account();

DROP TRIGGER IF EXISTS trg_enforce_active_account_quotes ON public.quotes;
CREATE TRIGGER trg_enforce_active_account_quotes
BEFORE INSERT OR UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_account();

DROP TRIGGER IF EXISTS trg_enforce_active_account_messages ON public.messages;
CREATE TRIGGER trg_enforce_active_account_messages
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_account();

DROP TRIGGER IF EXISTS trg_enforce_active_account_bookings ON public.bookings;
CREATE TRIGGER trg_enforce_active_account_bookings
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_account();

-- 3. conversations_update_full_field_exposure: tighten policy to lock non-read-tracking columns
DROP POLICY IF EXISTS "Participants can update last_read indirectly" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update read tracking" ON public.conversations;
CREATE POLICY "Participants can update read tracking"
ON public.conversations
FOR UPDATE
TO authenticated
USING (auth.uid() = organizer_id OR auth.uid() = hotel_owner_id)
WITH CHECK (
  (auth.uid() = organizer_id OR auth.uid() = hotel_owner_id)
  AND organizer_id   = (SELECT c.organizer_id   FROM public.conversations c WHERE c.id = conversations.id)
  AND hotel_owner_id = (SELECT c.hotel_owner_id FROM public.conversations c WHERE c.id = conversations.id)
  AND rfq_id         IS NOT DISTINCT FROM (SELECT c.rfq_id   FROM public.conversations c WHERE c.id = conversations.id)
  AND quote_id       IS NOT DISTINCT FROM (SELECT c.quote_id FROM public.conversations c WHERE c.id = conversations.id)
  AND hotel_id       = (SELECT c.hotel_id FROM public.conversations c WHERE c.id = conversations.id)
);

REVOKE EXECUTE ON FUNCTION public.is_account_active(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_non_admin_account_status_change() FROM anon, PUBLIC;
-- Defense-in-depth: revoke UPDATE privileges on sensitive profile columns from authenticated role.
-- Triggers still enforce the same rules; this adds a hard column-level guarantee at the RLS/grants layer.

REVOKE UPDATE (
  account_status,
  agency_verification_status,
  verification_reviewed_at,
  verification_reviewed_by,
  verification_rejection_reason,
  verification_trust_level,
  approved_by,
  approved_at,
  approval_notes,
  hotel_approval_status
) ON public.profiles FROM authenticated;

-- Ensure service_role retains full access for admin operations via edge/server functions.
GRANT ALL ON public.profiles TO service_role;
