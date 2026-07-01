
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
SET search_path TO 'public'
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
