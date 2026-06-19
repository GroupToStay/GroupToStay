
-- Phase 3: Rooms, Meal Plans, Amenities

-- hotel_rooms: add room_type_id and meal_plan_id
ALTER TABLE public.hotel_rooms
  ADD COLUMN IF NOT EXISTS room_type_id uuid REFERENCES public.room_types(id),
  ADD COLUMN IF NOT EXISTS meal_plan_id uuid REFERENCES public.meal_plans(id);

CREATE INDEX IF NOT EXISTS idx_hotel_rooms_room_type_id ON public.hotel_rooms(room_type_id);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_meal_plan_id ON public.hotel_rooms(meal_plan_id);

-- rfqs: add room_type_id (board_type enum stays)
ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS room_type_id uuid REFERENCES public.room_types(id);

CREATE INDEX IF NOT EXISTS idx_rfqs_room_type_id ON public.rfqs(room_type_id);

-- Helper for backfill
CREATE OR REPLACE FUNCTION public._norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT lower(btrim(coalesce(t,''))) $$;

-- Backfill hotel_rooms.room_type_id
UPDATE public.hotel_rooms hr
SET room_type_id = rt.id
FROM public.room_types rt
WHERE hr.room_type_id IS NULL
  AND (
    public._norm(hr.room_type) = public._norm(rt.name_en)
    OR public._norm(hr.room_type) = public._norm(rt.name_ar)
    OR (public._norm(hr.room_type) IN ('single','فردي','مفردة') AND rt.name_en='Single')
    OR (public._norm(hr.room_type) IN ('double','مزدوج','ثنائية') AND rt.name_en='Double')
    OR (public._norm(hr.room_type) IN ('triple','ثلاثي') AND rt.name_en='Triple')
    OR (public._norm(hr.room_type) IN ('quad','quadruple','رباعي') AND rt.name_en='Quad')
    OR (public._norm(hr.room_type) IN ('suite','جناح') AND rt.name_en='Suite')
    OR (public._norm(hr.room_type) IN ('family','family room','عائلية') AND rt.name_en='Family Room')
  );

-- Backfill rfqs.room_type_id from room_type_pref
UPDATE public.rfqs r
SET room_type_id = rt.id
FROM public.room_types rt
WHERE r.room_type_id IS NULL
  AND r.room_type_pref IS NOT NULL
  AND (
    public._norm(r.room_type_pref) = public._norm(rt.name_en)
    OR public._norm(r.room_type_pref) = public._norm(rt.name_ar)
    OR (public._norm(r.room_type_pref) IN ('single','فردي') AND rt.name_en='Single')
    OR (public._norm(r.room_type_pref) IN ('double','مزدوج') AND rt.name_en='Double')
    OR (public._norm(r.room_type_pref) IN ('triple','ثلاثي') AND rt.name_en='Triple')
    OR (public._norm(r.room_type_pref) IN ('quad','رباعي') AND rt.name_en='Quad')
    OR (public._norm(r.room_type_pref) IN ('suite','جناح') AND rt.name_en='Suite')
    OR (public._norm(r.room_type_pref) IN ('family','family room','عائلية') AND rt.name_en='Family Room')
  );

-- Hotel amenities join table
CREATE TABLE IF NOT EXISTS public.hotel_amenities (
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hotel_id, amenity_id)
);

GRANT SELECT ON public.hotel_amenities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_amenities TO authenticated;
GRANT ALL ON public.hotel_amenities TO service_role;

ALTER TABLE public.hotel_amenities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel amenities are viewable by everyone"
  ON public.hotel_amenities FOR SELECT USING (true);

CREATE POLICY "Hotel owners manage their amenities"
  ON public.hotel_amenities FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()));

CREATE POLICY "Admins manage all hotel amenities"
  ON public.hotel_amenities FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_hotel_amenities_hotel ON public.hotel_amenities(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_amenities_amenity ON public.hotel_amenities(amenity_id);

-- Backfill hotel_amenities from hotels.amenities text[]
INSERT INTO public.hotel_amenities (hotel_id, amenity_id)
SELECT DISTINCT h.id, a.id
FROM public.hotels h
CROSS JOIN LATERAL unnest(coalesce(h.amenities, ARRAY[]::text[])) AS amt(name)
JOIN public.amenities a
  ON public._norm(a.name_en) = public._norm(amt.name)
  OR public._norm(a.name_ar) = public._norm(amt.name)
ON CONFLICT DO NOTHING;

-- Extend unmapped_locations view to surface unmapped room types / amenities
DROP VIEW IF EXISTS public.unmapped_locations;
CREATE VIEW public.unmapped_locations
WITH (security_invoker = true)
AS
  SELECT 'hotel'::text AS record_type, h.id AS record_id, h.name AS label,
         h.country AS country_text, h.city AS city_text,
         NULL::text AS destination_country, NULL::text AS destination_city,
         NULL::text AS room_text
  FROM public.hotels h
  WHERE h.country_id IS NULL OR h.city_id IS NULL
  UNION ALL
  SELECT 'rfq', r.id, r.title, NULL, NULL, r.destination_country, r.destination_city,
         r.room_type_pref
  FROM public.rfqs r
  WHERE r.destination_country_id IS NULL OR r.destination_city_id IS NULL
     OR (r.room_type_pref IS NOT NULL AND r.room_type_id IS NULL)
  UNION ALL
  SELECT 'hotel_room', hr.id, hr.room_type, NULL, NULL, NULL, NULL, hr.room_type
  FROM public.hotel_rooms hr
  WHERE hr.room_type IS NOT NULL AND hr.room_type_id IS NULL;

REVOKE ALL ON public.unmapped_locations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.unmapped_locations TO authenticated;
