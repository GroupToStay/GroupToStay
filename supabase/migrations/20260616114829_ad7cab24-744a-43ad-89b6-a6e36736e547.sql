
-- 1. Fix message policy bypass
DROP POLICY IF EXISTS "Hotel messages organizer on open RFQ" ON public.messages;

-- 2. Prevent self-approval on profiles
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_approval_self_update ON public.profiles;
CREATE TRIGGER trg_prevent_profile_approval_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_approval_self_update();

-- 3. Remove public exposure of open RFQs - restrict to authenticated invited hotels and admins only
DROP POLICY IF EXISTS "Anyone views open RFQs" ON public.rfqs;

-- 4. Revoke EXECUTE from anon on SECURITY DEFINER helper functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_hotel_profile_approved(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_rfq_organizer(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_hotel_invited_to_rfq(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hotel_profile_approved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rfq_organizer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hotel_invited_to_rfq(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;
