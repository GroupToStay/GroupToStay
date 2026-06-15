
-- Make open RFQs publicly browsable, and allow hotels to message the organizer about open RFQs.

CREATE POLICY "Anyone views open RFQs"
ON public.rfqs
FOR SELECT
USING (status = 'open');

GRANT SELECT ON public.rfqs TO anon;
GRANT SELECT ON public.rfqs TO authenticated;

-- Allow hotel users to message the organizer of any open RFQ (even without an invitation).
CREATE POLICY "Hotel messages organizer on open RFQ"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.has_role(auth.uid(), 'hotel')
  AND EXISTS (
    SELECT 1 FROM public.rfqs r
    WHERE r.id = messages.rfq_id
      AND r.status = 'open'
      AND r.organizer_id = messages.recipient_id
  )
);

-- Allow organizer to reply to any hotel that contacted them about their RFQ.
CREATE POLICY "Organizer replies to any hotel about own RFQ"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.rfqs r
    WHERE r.id = messages.rfq_id
      AND r.organizer_id = auth.uid()
  )
);
