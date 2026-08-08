
-- 1. Prevent non-admins from updating sensitive profile columns via RLS
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND account_status IS NOT DISTINCT FROM (SELECT account_status FROM public.profiles WHERE id = auth.uid())
  AND agency_verification_status IS NOT DISTINCT FROM (SELECT agency_verification_status FROM public.profiles WHERE id = auth.uid())
  AND verification_reviewed_at IS NOT DISTINCT FROM (SELECT verification_reviewed_at FROM public.profiles WHERE id = auth.uid())
  AND verification_reviewed_by IS NOT DISTINCT FROM (SELECT verification_reviewed_by FROM public.profiles WHERE id = auth.uid())
  AND verification_rejection_reason IS NOT DISTINCT FROM (SELECT verification_rejection_reason FROM public.profiles WHERE id = auth.uid())
  AND verification_trust_level IS NOT DISTINCT FROM (SELECT verification_trust_level FROM public.profiles WHERE id = auth.uid())
  AND approved_by IS NOT DISTINCT FROM (SELECT approved_by FROM public.profiles WHERE id = auth.uid())
  AND approved_at IS NOT DISTINCT FROM (SELECT approved_at FROM public.profiles WHERE id = auth.uid())
  AND approval_notes IS NOT DISTINCT FROM (SELECT approval_notes FROM public.profiles WHERE id = auth.uid())
  AND hotel_approval_status IS NOT DISTINCT FROM (SELECT hotel_approval_status FROM public.profiles WHERE id = auth.uid())
);

-- 2. Restrictive policy: suspended users cannot write data on key tables
CREATE POLICY "Active accounts only on rfqs"
ON public.rfqs
AS RESTRICTIVE FOR ALL
TO authenticated
USING (public.is_account_active(auth.uid()))
WITH CHECK (public.is_account_active(auth.uid()));

CREATE POLICY "Active accounts only on quotes"
ON public.quotes
AS RESTRICTIVE FOR ALL
TO authenticated
USING (public.is_account_active(auth.uid()))
WITH CHECK (public.is_account_active(auth.uid()));

CREATE POLICY "Active accounts only on bookings"
ON public.bookings
AS RESTRICTIVE FOR ALL
TO authenticated
USING (public.is_account_active(auth.uid()))
WITH CHECK (public.is_account_active(auth.uid()));

CREATE POLICY "Active accounts only on messages"
ON public.messages
AS RESTRICTIVE FOR ALL
TO authenticated
USING (public.is_account_active(auth.uid()))
WITH CHECK (public.is_account_active(auth.uid()));

CREATE POLICY "Active accounts only on chat_messages"
ON public.chat_messages
AS RESTRICTIVE FOR ALL
TO authenticated
USING (public.is_account_active(auth.uid()))
WITH CHECK (public.is_account_active(auth.uid()));

CREATE POLICY "Active accounts only on conversations"
ON public.conversations
AS RESTRICTIVE FOR ALL
TO authenticated
USING (public.is_account_active(auth.uid()))
WITH CHECK (public.is_account_active(auth.uid()));

CREATE POLICY "Active accounts only on hotels"
ON public.hotels
AS RESTRICTIVE FOR ALL
TO authenticated
USING (public.is_account_active(auth.uid()))
WITH CHECK (public.is_account_active(auth.uid()));

-- 3. Simplify conversation update policy to rely on trigger and column grants
DROP POLICY IF EXISTS "Participants can update read tracking" ON public.conversations;
CREATE POLICY "Participants can update read tracking"
ON public.conversations
FOR UPDATE
TO authenticated
USING (auth.uid() = organizer_id OR auth.uid() = hotel_owner_id)
WITH CHECK (auth.uid() = organizer_id OR auth.uid() = hotel_owner_id);

-- Ensure the restrictive trigger still enforces last_message_* immutability
DROP TRIGGER IF EXISTS trg_restrict_conversation_participant_updates ON public.conversations;
CREATE TRIGGER trg_restrict_conversation_participant_updates
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.restrict_conversation_participant_updates();
