-- Additive hardening for the four production blockers found during external-Supabase QA.
-- This migration does not update or delete existing business rows.

-- Admin User Management needs to see every role, while non-admins retain own-role visibility.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'Admins view all roles'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins view all roles"
      ON public.user_roles FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), ''admin''))';
  END IF;
END $$;

-- Append-only RFQ lifecycle timeline.
CREATE TABLE IF NOT EXISTS public.rfq_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  invitation_id uuid REFERENCES public.rfq_invitations(id) ON DELETE SET NULL,
  actor_id uuid,
  event_type text NOT NULL CHECK (event_type IN (
    'rfq_created', 'rfq_quoting', 'rfq_awarded', 'rfq_closed', 'rfq_cancelled',
    'quote_submitted', 'quote_viewed', 'quote_shortlisted', 'quote_edited',
    'quote_accepted', 'quote_rejected', 'quote_withdrawn',
    'invitation_viewed', 'invitation_quoted', 'invitation_declined'
  )),
  from_status text,
  to_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfq_lifecycle_events_rfq_created
  ON public.rfq_lifecycle_events (rfq_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_lifecycle_events_quote
  ON public.rfq_lifecycle_events (quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rfq_lifecycle_events_invitation
  ON public.rfq_lifecycle_events (invitation_id) WHERE invitation_id IS NOT NULL;

ALTER TABLE public.rfq_lifecycle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rfq_lifecycle_events FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.rfq_lifecycle_events FROM authenticated;
GRANT SELECT ON public.rfq_lifecycle_events TO authenticated;
GRANT SELECT, INSERT ON public.rfq_lifecycle_events TO service_role;
REVOKE UPDATE, DELETE ON public.rfq_lifecycle_events FROM service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rfq_lifecycle_events'
      AND policyname = 'RFQ participants view lifecycle events'
  ) THEN
    EXECUTE 'CREATE POLICY "RFQ participants view lifecycle events"
      ON public.rfq_lifecycle_events FOR SELECT TO authenticated
      USING (
        public.has_role(auth.uid(), ''admin'')
        OR EXISTS (
          SELECT 1 FROM public.rfqs r
          WHERE r.id = rfq_lifecycle_events.rfq_id
            AND r.organizer_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.rfq_invitations i
          JOIN public.hotels h ON h.id = i.hotel_id
          WHERE i.rfq_id = rfq_lifecycle_events.rfq_id
            AND h.owner_id = auth.uid()
        )
      )';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_rfq_lifecycle_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_type text;
  _rfq_id uuid;
  _quote_id uuid;
  _invitation_id uuid;
  _from_status text;
  _to_status text;
BEGIN
  IF TG_TABLE_NAME = 'rfqs' THEN
    _rfq_id := NEW.id;
    IF TG_OP = 'UPDATE' THEN _from_status := OLD.status::text; END IF;
    _to_status := NEW.status::text;
    IF TG_OP = 'INSERT' THEN
      _event_type := 'rfq_created';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      _event_type := CASE NEW.status::text
        WHEN 'quoting' THEN 'rfq_quoting'
        WHEN 'awarded' THEN 'rfq_awarded'
        WHEN 'closed' THEN 'rfq_closed'
        WHEN 'cancelled' THEN 'rfq_cancelled'
      END;
    END IF;
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    _rfq_id := NEW.rfq_id;
    _quote_id := NEW.id;
    IF TG_OP = 'UPDATE' THEN _from_status := OLD.status::text; END IF;
    _to_status := NEW.status::text;
    IF TG_OP = 'INSERT' THEN
      _event_type := 'quote_submitted';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      _event_type := CASE NEW.status::text
        WHEN 'viewed' THEN 'quote_viewed'
        WHEN 'shortlisted' THEN 'quote_shortlisted'
        WHEN 'accepted' THEN 'quote_accepted'
        WHEN 'rejected' THEN 'quote_rejected'
        WHEN 'withdrawn' THEN 'quote_withdrawn'
      END;
    ELSIF ROW(NEW.total_price, NEW.price_per_room_night, NEW.board_included,
              NEW.notes, NEW.inclusions, NEW.included_services, NEW.valid_until)
          IS DISTINCT FROM
          ROW(OLD.total_price, OLD.price_per_room_night, OLD.board_included,
              OLD.notes, OLD.inclusions, OLD.included_services, OLD.valid_until) THEN
      _event_type := 'quote_edited';
    END IF;
  ELSIF TG_TABLE_NAME = 'rfq_invitations' THEN
    _rfq_id := NEW.rfq_id;
    _invitation_id := NEW.id;
    IF TG_OP = 'UPDATE' THEN _from_status := OLD.status::text; END IF;
    _to_status := NEW.status::text;
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      _event_type := CASE NEW.status::text
        WHEN 'viewed' THEN 'invitation_viewed'
        WHEN 'quoted' THEN 'invitation_quoted'
        WHEN 'declined' THEN 'invitation_declined'
      END;
    END IF;
  END IF;

  IF _event_type IS NOT NULL THEN
    INSERT INTO public.rfq_lifecycle_events (
      rfq_id, quote_id, invitation_id, actor_id, event_type, from_status, to_status
    ) VALUES (
      _rfq_id, _quote_id, _invitation_id, auth.uid(), _event_type, _from_status, _to_status
    );
  END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.record_rfq_lifecycle_event() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_record_rfq_lifecycle_event') THEN
    CREATE TRIGGER trg_record_rfq_lifecycle_event
      AFTER INSERT OR UPDATE ON public.rfqs
      FOR EACH ROW EXECUTE FUNCTION public.record_rfq_lifecycle_event();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_record_quote_lifecycle_event') THEN
    CREATE TRIGGER trg_record_quote_lifecycle_event
      AFTER INSERT OR UPDATE ON public.quotes
      FOR EACH ROW EXECUTE FUNCTION public.record_rfq_lifecycle_event();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_record_invitation_lifecycle_event') THEN
    CREATE TRIGGER trg_record_invitation_lifecycle_event
      AFTER UPDATE ON public.rfq_invitations
      FOR EACH ROW EXECUTE FUNCTION public.record_rfq_lifecycle_event();
  END IF;
END $$;

-- Require both an approved status and all required business-verification fields.
CREATE OR REPLACE FUNCTION public.is_agency_rfq_eligible(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = _user_id
          AND ur.role = 'organizer'
      )
      AND p.agency_verification_status = 'verified'
      AND NULLIF(btrim(COALESCE(p.legal_company_name, '')), '') IS NOT NULL
      AND p.country_id IS NOT NULL
      AND p.city_id IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.full_address, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.cr_number, '')), '') IS NOT NULL
      AND p.cr_expiry_date IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.issuing_authority, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.cr_document_path, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.contact_person_name, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.contact_person_position, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.contact_person_email, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.contact_person_phone, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.agency_type, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.annual_group_bookings, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.avg_rooms_per_booking, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.legal_billing_name, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.vat_billing_number, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.billing_address, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.billing_email, '')), '') IS NOT NULL
      AND p.legal_agreements_accepted_at IS NOT NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_agency_rfq_eligible(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_verified_agency_for_rfq()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(NEW.organizer_id, 'admin') THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_agency_rfq_eligible(NEW.organizer_id) THEN
    RAISE EXCEPTION 'Agency verification and all required profile information must be complete before creating requests';
  END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.require_verified_agency_for_rfq() FROM PUBLIC, anon, authenticated;

-- Keep submission-time validation aligned with the RFQ eligibility check.
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

  IF NEW.agency_verification_status IN ('submitted', 'pending_review')
     AND OLD.agency_verification_status IS DISTINCT FROM NEW.agency_verification_status THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = NEW.id
        AND role IN ('organizer', 'agency')
    ) INTO _is_agency;

    IF NOT _is_agency THEN
      RETURN NEW;
    END IF;

    IF OLD.agency_verification_status IN ('submitted', 'pending_review') THEN
      RAISE EXCEPTION 'A verification submission is already in progress';
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
  END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.validate_agency_verification_submission() FROM PUBLIC, anon, authenticated;
