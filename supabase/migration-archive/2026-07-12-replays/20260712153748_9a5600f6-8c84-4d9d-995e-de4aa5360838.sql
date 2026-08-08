
DROP VIEW IF EXISTS public.unmapped_locations;
CREATE VIEW public.unmapped_locations
WITH (security_invoker = true) AS
SELECT 'hotel'::text AS record_type, id AS record_id, name AS label, country AS country_text, city AS city_text
FROM public.hotels WHERE country_id IS NULL OR city_id IS NULL
UNION ALL
SELECT 'rfq', id, title, destination_country, destination_city
FROM public.rfqs WHERE destination_country_id IS NULL OR destination_city_id IS NULL;
REVOKE ALL ON public.unmapped_locations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.unmapped_locations TO authenticated;

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

-- Profiles: split phone + country
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL;

-- Hotels: archived flag for suspended hotels detached from owners
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Lock approved company (profiles.hotel_approval_status) so once approved it stays approved
CREATE OR REPLACE FUNCTION public.lock_company_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.hotel_approval_status = 'approved'
     AND NEW.hotel_approval_status IS DISTINCT FROM 'approved'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Approved companies cannot change status';
  END IF;
  -- Even admins cannot move an approved company back to anything else
  IF OLD.hotel_approval_status = 'approved'
     AND NEW.hotel_approval_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Approved companies are locked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_company_approval ON public.profiles;
CREATE TRIGGER trg_lock_company_approval
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.lock_company_approval();

-- Lock approved hotel listings: once approved, cannot become pending/suspended
CREATE OR REPLACE FUNCTION public.lock_hotel_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'approved'
     AND NEW.status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Approved hotels are locked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_hotel_approval ON public.hotels;
CREATE TRIGGER trg_lock_hotel_approval
BEFORE UPDATE ON public.hotels
FOR EACH ROW EXECUTE FUNCTION public.lock_hotel_approval();

-- Subscription waitlist
CREATE TABLE IF NOT EXISTS public.subscription_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  hotel_name text,
  requested_plan text NOT NULL CHECK (requested_plan IN ('professional','featured')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','notified')),
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.subscription_interest TO authenticated;
GRANT ALL ON public.subscription_interest TO service_role;

ALTER TABLE public.subscription_interest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own interest" ON public.subscription_interest;
CREATE POLICY "Users insert own interest" ON public.subscription_interest
FOR INSERT TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own interest" ON public.subscription_interest;
CREATE POLICY "Users read own interest" ON public.subscription_interest
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update interest" ON public.subscription_interest;
CREATE POLICY "Admins update interest" ON public.subscription_interest
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed feature flag
INSERT INTO public.platform_settings (key, value)
VALUES ('subscriptions_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'organizer');
BEGIN
  INSERT INTO public.profiles (
    id, full_name, org_name, phone, country, locale,
    country_code, phone_number, country_id,
    company_name, vat_number, cr_number, contact_email,
    id_type, id_number, hotel_approval_status
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'org_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'country',
    COALESCE(NEW.raw_user_meta_data->>'locale','en'),
    NEW.raw_user_meta_data->>'country_code',
    NEW.raw_user_meta_data->>'phone_number',
    NULLIF(NEW.raw_user_meta_data->>'country_id','')::uuid,
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'vat_number',
    NEW.raw_user_meta_data->>'cr_number',
    COALESCE(NEW.raw_user_meta_data->>'contact_email', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'id_type','')::public.id_doc_type,
    NEW.raw_user_meta_data->>'id_number',
    CASE WHEN _role = 'hotel' THEN 'pending'::public.hotel_approval_status ELSE NULL END
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$$;
