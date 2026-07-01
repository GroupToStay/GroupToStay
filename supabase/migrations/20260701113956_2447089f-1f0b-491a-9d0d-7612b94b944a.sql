
-- Server-side validation for Group Requests (RFQs): enforce required fields,
-- date order, and positive numeric ranges regardless of client-side checks.
CREATE OR REPLACE FUNCTION public.validate_rfq_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.title IS NULL OR length(btrim(NEW.title)) < 3 THEN
    RAISE EXCEPTION 'Request title must be at least 3 characters';
  END IF;
  IF NEW.destination_country_id IS NULL THEN
    RAISE EXCEPTION 'Destination country is required';
  END IF;
  IF NEW.destination_city_id IS NULL THEN
    RAISE EXCEPTION 'Destination city is required';
  END IF;
  IF NEW.check_in IS NULL OR NEW.check_out IS NULL THEN
    RAISE EXCEPTION 'Check-in and check-out dates are required';
  END IF;
  IF NEW.check_out <= NEW.check_in THEN
    RAISE EXCEPTION 'Check-out must be after check-in';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.check_in < CURRENT_DATE THEN
    RAISE EXCEPTION 'Check-in cannot be in the past';
  END IF;
  IF NEW.guests_count IS NULL OR NEW.guests_count < 1 OR NEW.guests_count > 100000 THEN
    RAISE EXCEPTION 'Guests count must be between 1 and 100000';
  END IF;
  IF NEW.rooms_needed IS NULL OR NEW.rooms_needed < 1 OR NEW.rooms_needed > 10000 THEN
    RAISE EXCEPTION 'Rooms needed must be between 1 and 10000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_rfq_row_trg ON public.rfqs;
CREATE TRIGGER validate_rfq_row_trg
BEFORE INSERT OR UPDATE ON public.rfqs
FOR EACH ROW EXECUTE FUNCTION public.validate_rfq_row();
