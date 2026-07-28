-- Allow company owners to complete verification data until approval while preserving
-- reviewer-only status, decision, and audit fields.

CREATE OR REPLACE FUNCTION public.restrict_profile_company_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_reviewer boolean :=
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'manage_approvals');
BEGIN
  IF _is_reviewer THEN
    RETURN NEW;
  END IF;

  -- Preserve the existing hotel-verification behavior.
  IF public.has_role(auth.uid(), 'hotel')
     AND (
       NEW.company_name IS DISTINCT FROM OLD.company_name
       OR NEW.vat_number IS DISTINCT FROM OLD.vat_number
       OR NEW.cr_number IS DISTINCT FROM OLD.cr_number
     ) THEN
    RAISE EXCEPTION 'Company name, VAT number, and CR number cannot be changed. Please contact support.';
  END IF;

  IF (
       auth.uid() IS DISTINCT FROM NEW.id
       OR COALESCE(OLD.agency_verification_status::text, 'draft')
          NOT IN ('draft', 'rejected')
     )
     AND (
       NEW.legal_company_name IS DISTINCT FROM OLD.legal_company_name
       OR NEW.company_name IS DISTINCT FROM OLD.company_name
       OR NEW.trade_name IS DISTINCT FROM OLD.trade_name
       OR NEW.country_id IS DISTINCT FROM OLD.country_id
       OR NEW.city_id IS DISTINCT FROM OLD.city_id
       OR NEW.full_address IS DISTINCT FROM OLD.full_address
       OR NEW.website IS DISTINCT FROM OLD.website
       OR NEW.year_established IS DISTINCT FROM OLD.year_established
       OR NEW.employees_count IS DISTINCT FROM OLD.employees_count
       OR NEW.cr_number IS DISTINCT FROM OLD.cr_number
       OR NEW.cr_expiry_date IS DISTINCT FROM OLD.cr_expiry_date
       OR NEW.issuing_authority IS DISTINCT FROM OLD.issuing_authority
       OR NEW.tourism_license_number IS DISTINCT FROM OLD.tourism_license_number
       OR NEW.tourism_license_authority IS DISTINCT FROM OLD.tourism_license_authority
       OR NEW.cr_document_path IS DISTINCT FROM OLD.cr_document_path
       OR NEW.tourism_license_document_path IS DISTINCT FROM OLD.tourism_license_document_path
       OR NEW.contact_person_name IS DISTINCT FROM OLD.contact_person_name
       OR NEW.contact_person_position IS DISTINCT FROM OLD.contact_person_position
       OR NEW.contact_person_email IS DISTINCT FROM OLD.contact_person_email
       OR NEW.contact_person_phone IS DISTINCT FROM OLD.contact_person_phone
       OR NEW.contact_person_whatsapp IS DISTINCT FROM OLD.contact_person_whatsapp
       OR NEW.agency_type IS DISTINCT FROM OLD.agency_type
       OR NEW.annual_group_bookings IS DISTINCT FROM OLD.annual_group_bookings
       OR NEW.avg_rooms_per_booking IS DISTINCT FROM OLD.avg_rooms_per_booking
       OR NEW.legal_billing_name IS DISTINCT FROM OLD.legal_billing_name
       OR NEW.vat_billing_number IS DISTINCT FROM OLD.vat_billing_number
       OR NEW.billing_address IS DISTINCT FROM OLD.billing_address
       OR NEW.billing_email IS DISTINCT FROM OLD.billing_email
       OR NEW.legal_agreements_accepted_at IS DISTINCT FROM OLD.legal_agreements_accepted_at
       OR NEW.verification_submitted_at IS DISTINCT FROM OLD.verification_submitted_at
     ) THEN
    RAISE EXCEPTION 'Agency verification information cannot be changed while it is under review or verified.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_approval_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_reviewer boolean :=
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'manage_approvals');
  _is_owner_submission boolean := COALESCE(
    auth.uid() = NEW.id
    AND COALESCE(OLD.agency_verification_status::text, 'draft') IN ('draft', 'rejected')
    AND NEW.agency_verification_status::text = 'pending_review',
    false
  );
BEGIN
  IF _is_reviewer THEN
    RETURN NEW;
  END IF;

  IF NEW.hotel_approval_status IS DISTINCT FROM OLD.hotel_approval_status
     OR (
       NEW.agency_verification_status IS DISTINCT FROM OLD.agency_verification_status
       AND NOT _is_owner_submission
     )
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approval_notes IS DISTINCT FROM OLD.approval_notes
     OR NEW.verification_reviewed_at IS DISTINCT FROM OLD.verification_reviewed_at
     OR NEW.verification_reviewed_by IS DISTINCT FROM OLD.verification_reviewed_by
     OR NEW.verification_trust_level IS DISTINCT FROM OLD.verification_trust_level
     OR (
       NEW.verification_submitted_at IS DISTINCT FROM OLD.verification_submitted_at
       AND NOT _is_owner_submission
     )
     OR (
       NEW.verification_rejection_reason IS DISTINCT FROM OLD.verification_rejection_reason
       AND NOT (_is_owner_submission AND NEW.verification_rejection_reason IS NULL)
     ) THEN
    RAISE EXCEPTION 'Approval fields can only be modified by authorized reviewers';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_agency_verification_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _missing text[] := ARRAY[]::text[];
  _previous_status text := COALESCE(OLD.agency_verification_status::text, 'draft');
BEGIN
  IF auth.uid() = NEW.id
     AND NEW.agency_verification_status = 'pending_review'
     AND OLD.agency_verification_status IS DISTINCT FROM NEW.agency_verification_status THEN
    IF NOT public.has_role(NEW.id, 'organizer') THEN
      RAISE EXCEPTION 'Only agency account owners can submit agency verification';
    END IF;

    IF _previous_status NOT IN ('draft', 'rejected') THEN
      RAISE EXCEPTION 'Agency verification cannot be submitted from status %', _previous_status;
    END IF;

    IF NULLIF(btrim(COALESCE(NEW.legal_company_name, '')), '') IS NULL THEN _missing := _missing || 'Legal Company Name'; END IF;
    IF NEW.country_id IS NULL THEN _missing := _missing || 'Country'; END IF;
    IF NEW.city_id IS NULL THEN _missing := _missing || 'City'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.full_address, '')), '') IS NULL THEN _missing := _missing || 'Address'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.cr_number, '')), '') IS NULL THEN _missing := _missing || 'CR Number'; END IF;
    IF NEW.cr_expiry_date IS NULL THEN _missing := _missing || 'CR Expiry Date'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.issuing_authority, '')), '') IS NULL THEN _missing := _missing || 'Issuing Authority'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.cr_document_path, '')), '') IS NULL THEN _missing := _missing || 'Commercial Registration Document'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.contact_person_name, '')), '') IS NULL THEN _missing := _missing || 'Contact Name'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.contact_person_position, '')), '') IS NULL THEN _missing := _missing || 'Contact Position'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.contact_person_email, '')), '') IS NULL THEN _missing := _missing || 'Contact Email'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.contact_person_phone, '')), '') IS NULL THEN _missing := _missing || 'Contact Phone'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.agency_type, '')), '') IS NULL THEN _missing := _missing || 'Agency Type'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.annual_group_bookings, '')), '') IS NULL THEN _missing := _missing || 'Annual Group Bookings'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.avg_rooms_per_booking, '')), '') IS NULL THEN _missing := _missing || 'Average Rooms Per Booking'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.legal_billing_name, '')), '') IS NULL THEN _missing := _missing || 'Legal Billing Name'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.vat_billing_number, '')), '') IS NULL THEN _missing := _missing || 'VAT Number'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.billing_address, '')), '') IS NULL THEN _missing := _missing || 'Billing Address'; END IF;
    IF NULLIF(btrim(COALESCE(NEW.billing_email, '')), '') IS NULL THEN _missing := _missing || 'Billing Email'; END IF;
    IF NEW.legal_agreements_accepted_at IS NULL THEN _missing := _missing || 'Legal Agreements'; END IF;

    IF array_length(_missing, 1) > 0 THEN
      RAISE EXCEPTION 'Missing required fields: %', array_to_string(_missing, ', ');
    END IF;

    NEW.verification_submitted_at := now();
    NEW.verification_rejection_reason := NULL;

    INSERT INTO public.agency_verification_events (
      agency_id,
      event_type,
      actor_id
    )
    VALUES (
      NEW.id,
      CASE WHEN _previous_status = 'rejected' THEN 'resubmitted' ELSE 'submitted' END,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- RLS owns row scope. PostgreSQL policies do not expose OLD, so the exact
-- draft/rejected -> pending_review transition is enforced by the existing
-- BEFORE UPDATE approval trigger, where both row versions are available.
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

REVOKE EXECUTE ON FUNCTION public.restrict_profile_company_fields()
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_approval_self_update()
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_agency_verification_submission()
FROM PUBLIC, anon, authenticated;
