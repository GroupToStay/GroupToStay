
-- Broader matching: match by city OR country (in either direction), case-insensitive, trimmed.
CREATE OR REPLACE FUNCTION public.match_rfq_to_hotels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'open' THEN
    INSERT INTO public.rfq_invitations (rfq_id, hotel_id)
    SELECT NEW.id, h.id
    FROM public.hotels h
    WHERE h.status = 'approved'
      AND (
        lower(btrim(h.city))    = lower(btrim(NEW.destination_city))
     OR lower(btrim(h.country)) = lower(btrim(NEW.destination_country))
     OR lower(btrim(h.city))    = lower(btrim(NEW.destination_country))
     OR lower(btrim(h.country)) = lower(btrim(NEW.destination_city))
      )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

-- New: when a hotel is (or becomes) approved, generate invitations for open RFQs that match.
CREATE OR REPLACE FUNCTION public.match_hotel_to_rfqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.rfq_invitations (rfq_id, hotel_id)
    SELECT r.id, NEW.id
    FROM public.rfqs r
    WHERE r.status = 'open'
      AND (
        lower(btrim(NEW.city))    = lower(btrim(r.destination_city))
     OR lower(btrim(NEW.country)) = lower(btrim(r.destination_country))
     OR lower(btrim(NEW.city))    = lower(btrim(r.destination_country))
     OR lower(btrim(NEW.country)) = lower(btrim(r.destination_city))
      )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS hotel_match_after_change ON public.hotels;
CREATE TRIGGER hotel_match_after_change
AFTER INSERT OR UPDATE OF status ON public.hotels
FOR EACH ROW EXECUTE FUNCTION public.match_hotel_to_rfqs();

-- Backfill invitations for currently approved hotels × open RFQs.
INSERT INTO public.rfq_invitations (rfq_id, hotel_id)
SELECT r.id, h.id
FROM public.rfqs r
JOIN public.hotels h ON h.status = 'approved'
WHERE r.status = 'open'
  AND (
    lower(btrim(h.city))    = lower(btrim(r.destination_city))
 OR lower(btrim(h.country)) = lower(btrim(r.destination_country))
 OR lower(btrim(h.city))    = lower(btrim(r.destination_country))
 OR lower(btrim(h.country)) = lower(btrim(r.destination_city))
  )
ON CONFLICT DO NOTHING;
