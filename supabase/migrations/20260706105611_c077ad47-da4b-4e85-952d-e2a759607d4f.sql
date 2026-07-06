-- Restrict conversation updates to read-tracking fields only for participants
CREATE OR REPLACE FUNCTION public.restrict_conversation_participant_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.rfq_id           IS DISTINCT FROM OLD.rfq_id
   OR NEW.quote_id        IS DISTINCT FROM OLD.quote_id
   OR NEW.hotel_id        IS DISTINCT FROM OLD.hotel_id
   OR NEW.organizer_id    IS DISTINCT FROM OLD.organizer_id
   OR NEW.hotel_owner_id  IS DISTINCT FROM OLD.hotel_owner_id
   OR NEW.created_at      IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Participants may only update read-tracking fields on conversations';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_conversation_participant_updates ON public.conversations;
CREATE TRIGGER trg_restrict_conversation_participant_updates
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.restrict_conversation_participant_updates();