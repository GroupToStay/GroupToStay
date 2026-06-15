
-- 1) Tighten bookings INSERT to prevent referencing other organizers' RFQs/quotes
DROP POLICY IF EXISTS "Organizer creates booking" ON public.bookings;
CREATE POLICY "Organizer creates booking" ON public.bookings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = organizer_id
  AND EXISTS (
    SELECT 1 FROM public.rfqs r
    WHERE r.id = bookings.rfq_id AND r.organizer_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = bookings.quote_id
      AND q.rfq_id = bookings.rfq_id
      AND q.hotel_id = bookings.hotel_id
  )
);

-- 2) Tighten messages INSERT so only RFQ participants can post in a thread
DROP POLICY IF EXISTS "Sender sends message" ON public.messages;
CREATE POLICY "Sender sends message" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (
    EXISTS (
      SELECT 1 FROM public.rfqs r
      WHERE r.id = messages.rfq_id AND r.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.rfq_invitations i
      JOIN public.hotels h ON h.id = i.hotel_id
      WHERE i.rfq_id = messages.rfq_id AND h.owner_id = auth.uid()
    )
  )
);

-- 3) Remove organizer self-invite on rfq_invitations; matching is handled by
--    the system trigger match_rfq_to_hotels and by admins.
DROP POLICY IF EXISTS "Organizer invites on own RFQ" ON public.rfq_invitations;

-- 4) Revoke EXECUTE on SECURITY DEFINER helpers from anon/PUBLIC.
--    They remain available to `authenticated` because RLS policies invoke
--    them during query evaluation as the current role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_hotel_profile_approved(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_rfq_to_hotels() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_organizer_quote_updates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
