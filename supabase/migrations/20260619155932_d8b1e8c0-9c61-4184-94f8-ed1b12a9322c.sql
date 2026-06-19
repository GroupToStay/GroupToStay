
CREATE OR REPLACE FUNCTION public.restrict_organizer_booking_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = NEW.hotel_id AND h.owner_id = auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
     OR NEW.total_amount     IS DISTINCT FROM OLD.total_amount
     OR NEW.hotel_id         IS DISTINCT FROM OLD.hotel_id
     OR NEW.quote_id         IS DISTINCT FROM OLD.quote_id
     OR NEW.rfq_id           IS DISTINCT FROM OLD.rfq_id
     OR NEW.organizer_id     IS DISTINCT FROM OLD.organizer_id
     OR NEW.contract_url     IS DISTINCT FROM OLD.contract_url
  THEN
    RAISE EXCEPTION 'Organizers may only update booking status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_organizer_booking_updates_trg ON public.bookings;
CREATE TRIGGER restrict_organizer_booking_updates_trg
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.restrict_organizer_booking_updates();

DROP POLICY IF EXISTS "Anyone reads settings" ON public.platform_settings;
CREATE POLICY "Authenticated reads settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);
