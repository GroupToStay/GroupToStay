DROP POLICY IF EXISTS "Agency owner can insert submission events only" ON public.agency_verification_events;
CREATE POLICY "Agency owner can insert submission events only" ON public.agency_verification_events
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = auth.uid()
    AND actor_id = auth.uid()
    AND event_type = ANY (ARRAY['submitted'::text, 'resubmitted'::text])
  );