
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
