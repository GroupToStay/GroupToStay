
-- Add cities referenced by existing hotels
INSERT INTO public.cities (country_id, name_en, name_ar)
SELECT c.id, v.en, v.ar FROM public.countries c
JOIN (VALUES
  ('AE','Dubai','دبي'),
  ('TR','Istanbul','إسطنبول')
) AS v(code, en, ar) ON v.code = c.code
ON CONFLICT (country_id, name_en) DO NOTHING;

-- ============ HOTELS: new FK columns ============
ALTER TABLE public.hotels
  ADD COLUMN country_id uuid REFERENCES public.countries(id),
  ADD COLUMN city_id uuid REFERENCES public.cities(id),
  ADD COLUMN hotel_type_id uuid REFERENCES public.hotel_types(id);

CREATE INDEX idx_hotels_country_id ON public.hotels(country_id);
CREATE INDEX idx_hotels_city_id ON public.hotels(city_id);

-- ============ RFQS: new FK columns ============
ALTER TABLE public.rfqs
  ADD COLUMN destination_country_id uuid REFERENCES public.countries(id),
  ADD COLUMN destination_city_id uuid REFERENCES public.cities(id);

CREATE INDEX idx_rfqs_destination_country_id ON public.rfqs(destination_country_id);
CREATE INDEX idx_rfqs_destination_city_id ON public.rfqs(destination_city_id);

-- ============ BACKFILL: helper to normalize text ============
CREATE OR REPLACE FUNCTION public._norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(coalesce(t,'')))
$$;

-- Backfill hotels country_id
UPDATE public.hotels h SET country_id = c.id
FROM public.countries c
WHERE h.country_id IS NULL
  AND (
    public._norm(h.country) = public._norm(c.name_en)
    OR public._norm(h.country) = public._norm(c.name_ar)
    OR public._norm(h.country) = lower(c.code)
    OR (public._norm(h.country) = 'uae' AND c.code = 'AE')
    OR (public._norm(h.country) IN ('السعوديه','السعودية','المملكة العربية السعودية') AND c.code='SA')
  );

-- Backfill hotels city_id (must match within the chosen country when possible)
UPDATE public.hotels h SET city_id = ci.id
FROM public.cities ci
WHERE h.city_id IS NULL
  AND (h.country_id IS NULL OR ci.country_id = h.country_id)
  AND (
    public._norm(h.city) = public._norm(ci.name_en)
    OR public._norm(h.city) = public._norm(ci.name_ar)
    OR (public._norm(h.city) IN ('madina','medina') AND ci.name_en='Madinah')
    OR (public._norm(h.city) = 'المدينة' AND ci.name_en='Madinah')
    OR (public._norm(h.city) IN ('mekka','mecca') AND ci.name_en='Makkah')
  );

-- Backfill rfqs destination_country_id
UPDATE public.rfqs r SET destination_country_id = c.id
FROM public.countries c
WHERE r.destination_country_id IS NULL
  AND (
    public._norm(r.destination_country) = public._norm(c.name_en)
    OR public._norm(r.destination_country) = public._norm(c.name_ar)
    OR public._norm(r.destination_country) = lower(c.code)
    OR (public._norm(r.destination_country) = 'uae' AND c.code = 'AE')
    OR (public._norm(r.destination_country) IN ('السعوديه','السعودية','المملكة العربية السعودية') AND c.code='SA')
  );

-- Backfill rfqs destination_city_id
UPDATE public.rfqs r SET destination_city_id = ci.id
FROM public.cities ci
WHERE r.destination_city_id IS NULL
  AND (r.destination_country_id IS NULL OR ci.country_id = r.destination_country_id)
  AND (
    public._norm(r.destination_city) = public._norm(ci.name_en)
    OR public._norm(r.destination_city) = public._norm(ci.name_ar)
    OR (public._norm(r.destination_city) IN ('madina','medina') AND ci.name_en='Madinah')
    OR (public._norm(r.destination_city) = 'المدينة' AND ci.name_en='Madinah')
    OR (public._norm(r.destination_city) IN ('mekka','mecca') AND ci.name_en='Makkah')
  );

DROP FUNCTION public._norm(text);

-- ============ NEW MATCHING TRIGGERS (by city_id, fallback country_id) ============
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
        (NEW.destination_city_id IS NOT NULL AND h.city_id = NEW.destination_city_id)
        OR (NEW.destination_city_id IS NULL AND NEW.destination_country_id IS NOT NULL AND h.country_id = NEW.destination_country_id)
      )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

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
        (r.destination_city_id IS NOT NULL AND NEW.city_id = r.destination_city_id)
        OR (r.destination_city_id IS NULL AND r.destination_country_id IS NOT NULL AND NEW.country_id = r.destination_country_id)
      )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============ Admin view: unmapped locations ============
CREATE OR REPLACE VIEW public.unmapped_locations AS
SELECT 'hotel'::text AS record_type, id AS record_id, name AS label, country AS country_text, city AS city_text
FROM public.hotels WHERE country_id IS NULL OR city_id IS NULL
UNION ALL
SELECT 'rfq', id, title, destination_country, destination_city
FROM public.rfqs WHERE destination_country_id IS NULL OR destination_city_id IS NULL;

GRANT SELECT ON public.unmapped_locations TO authenticated;
