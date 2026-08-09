
DROP POLICY IF EXISTS "Agency owner can insert own events" ON public.agency_verification_events;

CREATE POLICY "Agency owner can insert submission events only"
  ON public.agency_verification_events FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = auth.uid()
    AND event_type IN ('submitted', 'resubmitted')
  );

CREATE POLICY "Admins can insert all verification events"
  ON public.agency_verification_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
