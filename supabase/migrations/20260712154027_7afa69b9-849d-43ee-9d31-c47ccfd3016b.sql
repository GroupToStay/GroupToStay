
-- Enforce verified-agency gating at the database level

-- Message-level check: unverified agencies cannot send messages
CREATE OR REPLACE FUNCTION public.require_verified_agency_for_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _status public.agency_verification_status;
  _is_agency boolean;
BEGIN
  IF NEW.sender_id IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(NEW.sender_id, 'admin') THEN RETURN NEW; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.sender_id AND role IN ('organizer','agency')
  ) INTO _is_agency;
  IF NOT _is_agency THEN RETURN NEW; END IF;
  SELECT agency_verification_status INTO _status
  FROM public.profiles WHERE id = NEW.sender_id;
  IF _status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Agency must be verified to send messages';
  END IF;
  RETURN NEW;
END $$;

-- Invitation-level check: block agencies from opening quotation threads
-- when they aren't verified (covers direct RPC/insert into rfq_invitations)
CREATE OR REPLACE FUNCTION public.require_verified_agency_for_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _organizer uuid;
  _status public.agency_verification_status;
BEGIN
  SELECT organizer_id INTO _organizer FROM public.rfqs WHERE id = NEW.rfq_id;
  IF _organizer IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(_organizer, 'admin') THEN RETURN NEW; END IF;
  SELECT agency_verification_status INTO _status
  FROM public.profiles WHERE id = _organizer;
  IF _status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Agency must be verified before quotation requests can be sent';
  END IF;
  RETURN NEW;
END $$;

-- Drop and (re)attach triggers idempotently
DROP TRIGGER IF EXISTS trg_require_verified_agency_rfq ON public.rfqs;
CREATE TRIGGER trg_require_verified_agency_rfq
  BEFORE INSERT ON public.rfqs
  FOR EACH ROW EXECUTE FUNCTION public.require_verified_agency_for_rfq();

DROP TRIGGER IF EXISTS trg_validate_rfq_row ON public.rfqs;
CREATE TRIGGER trg_validate_rfq_row
  BEFORE INSERT OR UPDATE ON public.rfqs
  FOR EACH ROW EXECUTE FUNCTION public.validate_rfq_row();

DROP TRIGGER IF EXISTS trg_require_verified_agency_conversation ON public.conversations;
CREATE TRIGGER trg_require_verified_agency_conversation
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.require_verified_agency_for_conversation();

DROP TRIGGER IF EXISTS trg_require_verified_agency_message ON public.messages;
CREATE TRIGGER trg_require_verified_agency_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.require_verified_agency_for_message();

DROP TRIGGER IF EXISTS trg_require_verified_agency_invitation ON public.rfq_invitations;
CREATE TRIGGER trg_require_verified_agency_invitation
  BEFORE INSERT ON public.rfq_invitations
  FOR EACH ROW EXECUTE FUNCTION public.require_verified_agency_for_invitation();

-- 1) Whitelist agency visibility for hotels: only verified agencies
DROP VIEW IF EXISTS public.agencies_public;
CREATE VIEW public.agencies_public
WITH (security_invoker = true) AS
SELECT
  p.id,
  COALESCE(NULLIF(p.trade_name, ''),
           NULLIF(p.legal_company_name, ''),
           NULLIF(p.company_name, ''),
           NULLIF(p.org_name, ''),
           p.full_name) AS name,
  p.country,
  p.country_id,
  p.city_id,
  p.agency_type,
  p.website,
  p.year_established,
  p.agency_verification_status,
  p.verification_trust_level
FROM public.profiles p
WHERE p.agency_verification_status = 'verified'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'organizer'
  );

GRANT SELECT ON public.agencies_public TO authenticated;

-- 2) Storage hardening for agency-documents bucket
--    Restrictive policy: no matter which permissive policy grants access,
--    non-owner / non-admin can never touch objects in this bucket.
DROP POLICY IF EXISTS "agency_docs_owner_or_admin_only" ON storage.objects;
CREATE POLICY "agency_docs_owner_or_admin_only" ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    bucket_id <> 'agency-documents' OR (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    bucket_id <> 'agency-documents' OR (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

--    Restrictive INSERT: enforce allowed MIME types and 10MB size limit
DROP POLICY IF EXISTS "agency_docs_mime_and_size_check" ON storage.objects;
CREATE POLICY "agency_docs_mime_and_size_check" ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id <> 'agency-documents' OR (
      (metadata->>'mimetype') IN ('application/pdf','image/jpeg','image/png')
      AND COALESCE((metadata->>'size')::bigint, 0) <= 10485760
    )
  );

--    Deny anon completely
DROP POLICY IF EXISTS "agency_docs_no_anon" ON storage.objects;
CREATE POLICY "agency_docs_no_anon" ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon
  USING (bucket_id <> 'agency-documents')
  WITH CHECK (bucket_id <> 'agency-documents');

-- 3) Server-side required-field validation + duplicate submission prevention
CREATE OR REPLACE FUNCTION public.validate_agency_verification_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _missing text[] := ARRAY[]::text[];
  _is_agency boolean;
BEGIN
  IF NEW.agency_verification_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only enforce on transitions into an active review state
  IF NEW.agency_verification_status IN ('submitted','pending_review')
     AND (OLD.agency_verification_status IS DISTINCT FROM NEW.agency_verification_status) THEN

    SELECT EXISTS(
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.id AND role IN ('organizer','agency')
    ) INTO _is_agency;
    IF NOT _is_agency THEN
      RETURN NEW;
    END IF;

    -- Duplicate active submission guard
    IF OLD.agency_verification_status IN ('submitted','pending_review') THEN
      RAISE EXCEPTION 'A verification submission is already in progress';
    END IF;

    IF NULLIF(btrim(COALESCE(NEW.legal_company_name,'')), '') IS NULL THEN _missing := _missing || 'Legal Company Name'; END IF;
    IF NEW.country_id IS NULL THEN _missing := _missing || 'Country'; END IF;
    IF NEW.city_id IS NULL THEN _missing := _missing || 'City'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.full_address,'')), '') IS NULL THEN _missing := _missing || 'Address'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.cr_number,'')), '') IS NULL THEN _missing := _missing || 'CR Number'; END IF;
    IF NEW.cr_expiry_date IS NULL THEN _missing := _missing || 'CR Expiry Date'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.issuing_authority,'')), '') IS NULL THEN _missing := _missing || 'Issuing Authority'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.contact_person_name,'')), '') IS NULL THEN _missing := _missing || 'Contact Name'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.contact_person_email,'')), '') IS NULL THEN _missing := _missing || 'Contact Email'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.contact_person_phone,'')), '') IS NULL THEN _missing := _missing || 'Contact Phone'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.agency_type,'')), '') IS NULL THEN _missing := _missing || 'Agency Type'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.legal_billing_name,'')), '') IS NULL THEN _missing := _missing || 'Legal Billing Name'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.vat_billing_number,'')), '') IS NULL THEN _missing := _missing || 'VAT Number'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.billing_address,'')), '') IS NULL THEN _missing := _missing || 'Billing Address'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.billing_email,'')), '') IS NULL THEN _missing := _missing || 'Billing Email'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.cr_document_path,'')), '') IS NULL THEN _missing := _missing || 'Commercial Registration Document'; END IF;
    IF NEW.legal_agreements_accepted_at IS NULL THEN _missing := _missing || 'Legal Agreements'; END IF;

    IF array_length(_missing, 1) > 0 THEN
      RAISE EXCEPTION 'Missing required fields: %', array_to_string(_missing, ', ');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_agency_verification_submission ON public.profiles;
CREATE TRIGGER trg_validate_agency_verification_submission
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_agency_verification_submission();

REVOKE EXECUTE ON FUNCTION public.validate_agency_verification_submission() FROM PUBLIC, anon, authenticated;
-- Restrict hotel directory access to protect the RFQ marketplace model.
-- Visitors cannot read hotel rows.
-- Hotels can read only their own hotel rows.
-- Organizers can read hotels only when tied to their own RFQs/invitations/quotes.
-- Admins retain full hotel visibility.

ALTER VIEW public.hotels_public SET (security_invoker = on);

REVOKE SELECT ON public.hotels FROM anon;

DO $$
DECLARE
  selectable_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ')
  INTO selectable_columns
  FROM pg_attribute
  WHERE attrelid = 'public.hotels'::regclass
    AND attnum > 0
    AND NOT attisdropped
    AND has_column_privilege('anon', 'public.hotels', attname, 'SELECT');

  IF selectable_columns IS NOT NULL THEN
    EXECUTE format('REVOKE SELECT (%s) ON public.hotels FROM anon', selectable_columns);
  END IF;
END $$;

REVOKE SELECT ON public.hotels_public FROM anon;
GRANT SELECT ON public.hotels_public TO authenticated;

DROP POLICY IF EXISTS "Approved hotels public" ON public.hotels;
DROP POLICY IF EXISTS "Approved hotels visible to authenticated" ON public.hotels;
DROP POLICY IF EXISTS "Organizer views hotels tied to own RFQs" ON public.hotels;

CREATE OR REPLACE FUNCTION public.can_view_hotel_through_rfq(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rfq_invitations i
    JOIN public.rfqs r ON r.id = i.rfq_id
    WHERE i.hotel_id = _hotel_id
      AND r.organizer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.quotes q
    JOIN public.rfqs r ON r.id = q.rfq_id
    WHERE q.hotel_id = _hotel_id
      AND r.organizer_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_hotel_through_rfq(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_hotel_through_rfq(uuid) TO authenticated;

CREATE POLICY "Organizer views hotels tied to own RFQs"
ON public.hotels
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'organizer')
  AND public.can_view_hotel_through_rfq(hotels.id)
);
-- Admin management page support.
-- Keeps pages admin-only through existing /admin route guard and Supabase RLS.

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
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change account status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_non_admin_account_status_change ON public.profiles;
CREATE TRIGGER trg_prevent_non_admin_account_status_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_non_admin_account_status_change();

DROP POLICY IF EXISTS "Admin updates all RFQs" ON public.rfqs;
CREATE POLICY "Admin updates all RFQs"
ON public.rfqs
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin deletes all RFQs" ON public.rfqs;
CREATE POLICY "Admin deletes all RFQs"
ON public.rfqs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
