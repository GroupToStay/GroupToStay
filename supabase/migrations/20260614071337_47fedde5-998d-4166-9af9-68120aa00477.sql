-- 1) user_roles: restrict INSERT/UPDATE/DELETE to admins only
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) bookings: add UPDATE/DELETE policies
CREATE POLICY "Admin updates bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Organizer updates own booking" ON public.bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Hotel owner updates own booking" ON public.bookings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = bookings.hotel_id AND h.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = bookings.hotel_id AND h.owner_id = auth.uid()));

CREATE POLICY "Admin deletes bookings" ON public.bookings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) messages: scope UPDATE/DELETE to sender
CREATE POLICY "Sender updates own message" ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Sender deletes own message" ON public.messages
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- 4) rfq_invitations: restrict INSERT/DELETE
CREATE POLICY "Admin inserts invites" ON public.rfq_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Organizer invites on own RFQ" ON public.rfq_invitations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_invitations.rfq_id AND r.organizer_id = auth.uid()));

CREATE POLICY "Admin deletes invites" ON public.rfq_invitations
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Organizer deletes own RFQ invites" ON public.rfq_invitations
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_invitations.rfq_id AND r.organizer_id = auth.uid()));

-- 5) quotes: restrict organizer UPDATE to status field only via trigger
DROP POLICY IF EXISTS "Organizer updates quote status on own RFQ" ON public.quotes;

CREATE POLICY "Organizer updates quote status on own RFQ" ON public.quotes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = quotes.rfq_id AND r.organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = quotes.rfq_id AND r.organizer_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.restrict_organizer_quote_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = NEW.hotel_id AND h.owner_id = auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.total_price       IS DISTINCT FROM OLD.total_price
   OR NEW.price_per_room_night IS DISTINCT FROM OLD.price_per_room_night
   OR NEW.currency         IS DISTINCT FROM OLD.currency
   OR NEW.board_included   IS DISTINCT FROM OLD.board_included
   OR NEW.valid_until      IS DISTINCT FROM OLD.valid_until
   OR NEW.inclusions       IS DISTINCT FROM OLD.inclusions
   OR NEW.notes            IS DISTINCT FROM OLD.notes
   OR NEW.rfq_id           IS DISTINCT FROM OLD.rfq_id
   OR NEW.hotel_id         IS DISTINCT FROM OLD.hotel_id
  THEN
    RAISE EXCEPTION 'Organizers may only update quote status';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restrict_organizer_quote_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_restrict_organizer_quote_updates ON public.quotes;
CREATE TRIGGER trg_restrict_organizer_quote_updates
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.restrict_organizer_quote_updates();

-- 6) Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_rfq_to_hotels() FROM PUBLIC, anon, authenticated;