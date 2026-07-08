
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
