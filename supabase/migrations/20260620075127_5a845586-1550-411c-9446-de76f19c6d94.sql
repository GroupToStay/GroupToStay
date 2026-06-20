
DROP POLICY IF EXISTS "Hotel photos public read" ON storage.objects;

DROP POLICY IF EXISTS "Anyone reads settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Authenticated reads settings" ON public.platform_settings;
CREATE POLICY "Authenticated reads settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS trg_restrict_organizer_booking_updates ON public.bookings;
CREATE TRIGGER trg_restrict_organizer_booking_updates
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.restrict_organizer_booking_updates();

DROP TRIGGER IF EXISTS trg_restrict_organizer_quote_updates ON public.quotes;
CREATE TRIGGER trg_restrict_organizer_quote_updates
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.restrict_organizer_quote_updates();

CREATE OR REPLACE FUNCTION public._norm(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT lower(btrim(coalesce(t,''))) $$;
