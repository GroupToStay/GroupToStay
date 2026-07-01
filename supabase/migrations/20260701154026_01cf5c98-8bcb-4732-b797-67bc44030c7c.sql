
-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.agency_verification_status AS ENUM ('draft','submitted','pending_review','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_company_name text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id),
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS year_established int,
  ADD COLUMN IF NOT EXISTS employees_count text,
  ADD COLUMN IF NOT EXISTS cr_expiry_date date,
  ADD COLUMN IF NOT EXISTS issuing_authority text,
  ADD COLUMN IF NOT EXISTS tourism_license_number text,
  ADD COLUMN IF NOT EXISTS tourism_license_authority text,
  ADD COLUMN IF NOT EXISTS cr_document_path text,
  ADD COLUMN IF NOT EXISTS tourism_license_document_path text,
  ADD COLUMN IF NOT EXISTS contact_person_name text,
  ADD COLUMN IF NOT EXISTS contact_person_position text,
  ADD COLUMN IF NOT EXISTS contact_person_email text,
  ADD COLUMN IF NOT EXISTS contact_person_phone text,
  ADD COLUMN IF NOT EXISTS contact_person_whatsapp text,
  ADD COLUMN IF NOT EXISTS annual_group_bookings text,
  ADD COLUMN IF NOT EXISTS avg_rooms_per_booking text,
  ADD COLUMN IF NOT EXISTS legal_billing_name text,
  ADD COLUMN IF NOT EXISTS vat_billing_number text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS legal_agreements_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS agency_verification_status public.agency_verification_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS verification_rejection_reason text,
  ADD COLUMN IF NOT EXISTS verification_trust_level text DEFAULT 'verified';

-- 3. Verification events history
CREATE TABLE IF NOT EXISTS public.agency_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('submitted','approved','rejected','info_requested','resubmitted')),
  notes text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.agency_verification_events TO authenticated;
GRANT ALL ON public.agency_verification_events TO service_role;
ALTER TABLE public.agency_verification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency owner can view own events"
  ON public.agency_verification_events FOR SELECT TO authenticated
  USING (agency_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Agency owner can insert own events"
  ON public.agency_verification_events FOR INSERT TO authenticated
  WITH CHECK (agency_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 4. Public agencies view (safe fields only)
CREATE OR REPLACE VIEW public.agencies_public AS
SELECT
  p.id,
  COALESCE(NULLIF(p.trade_name,''), NULLIF(p.legal_company_name,''), NULLIF(p.company_name,''), NULLIF(p.org_name,''), p.full_name) AS name,
  p.country,
  p.country_id,
  p.city_id,
  p.agency_type,
  p.website,
  p.year_established,
  p.agency_verification_status,
  p.verification_trust_level
FROM public.profiles p
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'organizer');

GRANT SELECT ON public.agencies_public TO authenticated, anon;

-- 5. RFQ extensions
ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS hotel_categories_v2 text[],
  ADD COLUMN IF NOT EXISTS requirements text;

-- 6. Verification gating trigger for RFQs
CREATE OR REPLACE FUNCTION public.require_verified_agency_for_rfq()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE _status public.agency_verification_status;
BEGIN
  IF public.has_role(NEW.organizer_id, 'admin') THEN RETURN NEW; END IF;
  SELECT agency_verification_status INTO _status FROM public.profiles WHERE id = NEW.organizer_id;
  IF _status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Agency must be verified to create requests';
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_require_verified_agency_for_rfq ON public.rfqs;
CREATE TRIGGER trg_require_verified_agency_for_rfq
BEFORE INSERT ON public.rfqs
FOR EACH ROW EXECUTE FUNCTION public.require_verified_agency_for_rfq();

-- 7. Verification gating trigger for conversations (organizer starting chat)
CREATE OR REPLACE FUNCTION public.require_verified_agency_for_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE _status public.agency_verification_status;
BEGIN
  IF NEW.organizer_id IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(NEW.organizer_id, 'admin') THEN RETURN NEW; END IF;
  SELECT agency_verification_status INTO _status FROM public.profiles WHERE id = NEW.organizer_id;
  IF _status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Agency must be verified to contact hotels';
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_require_verified_agency_for_conversation ON public.conversations;
CREATE TRIGGER trg_require_verified_agency_for_conversation
BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.require_verified_agency_for_conversation();

-- 8. Backfill existing agencies
UPDATE public.profiles p
SET agency_verification_status = 'verified',
    verification_reviewed_at = now()
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'organizer')
  AND EXISTS (SELECT 1 FROM public.rfqs r WHERE r.organizer_id = p.id)
  AND (p.agency_verification_status IS NULL OR p.agency_verification_status = 'draft');

UPDATE public.profiles p
SET agency_verification_status = 'draft'
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'organizer')
  AND p.agency_verification_status IS NULL;

-- 9. Storage RLS: agency-documents bucket
-- Path convention: <agency_id>/<filename>
CREATE POLICY "Agency owners can upload own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agency-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Agency owners can update own documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'agency-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Agency owners can delete own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'agency-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Agency owners and admins can read agency documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'agency-documents' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
