
CREATE OR REPLACE FUNCTION public.is_rfq_organizer(_rfq_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rfqs WHERE id = _rfq_id AND organizer_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_hotel_invited_to_rfq(_rfq_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rfq_invitations i
    JOIN public.hotels h ON h.id = i.hotel_id
    WHERE i.rfq_id = _rfq_id AND h.owner_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "Invited hotel views RFQ" ON public.rfqs;
CREATE POLICY "Invited hotel views RFQ" ON public.rfqs
  FOR SELECT USING (public.is_hotel_invited_to_rfq(id, auth.uid()));

DROP POLICY IF EXISTS "Organizer sees own RFQ invites" ON public.rfq_invitations;
CREATE POLICY "Organizer sees own RFQ invites" ON public.rfq_invitations
  FOR SELECT USING (public.is_rfq_organizer(rfq_id, auth.uid()));

DROP POLICY IF EXISTS "Organizer deletes own RFQ invites" ON public.rfq_invitations;
CREATE POLICY "Organizer deletes own RFQ invites" ON public.rfq_invitations
  FOR DELETE USING (public.is_rfq_organizer(rfq_id, auth.uid()));

DROP POLICY IF EXISTS "Organizer views quotes on own RFQ" ON public.quotes;
CREATE POLICY "Organizer views quotes on own RFQ" ON public.quotes
  FOR SELECT USING (public.is_rfq_organizer(rfq_id, auth.uid()));

DROP POLICY IF EXISTS "Organizer updates quote status on own RFQ" ON public.quotes;
CREATE POLICY "Organizer updates quote status on own RFQ" ON public.quotes
  FOR UPDATE USING (public.is_rfq_organizer(rfq_id, auth.uid()))
  WITH CHECK (public.is_rfq_organizer(rfq_id, auth.uid()));
