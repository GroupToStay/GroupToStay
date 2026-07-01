
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
