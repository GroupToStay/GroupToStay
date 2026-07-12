
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

-- ============ COUNTRIES ============
CREATE TABLE public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.countries TO anon, authenticated;
GRANT ALL ON public.countries TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active countries" ON public.countries FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage countries" ON public.countries FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_countries_updated BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CITIES ============
CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, name_en)
);
CREATE INDEX idx_cities_country ON public.cities(country_id);
GRANT SELECT ON public.cities TO anon, authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active cities" ON public.cities FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage cities" ON public.cities FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cities_updated BEFORE UPDATE ON public.cities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HOTEL TYPES ============
CREATE TABLE public.hotel_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hotel_types TO anon, authenticated;
GRANT ALL ON public.hotel_types TO service_role;
ALTER TABLE public.hotel_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active hotel types" ON public.hotel_types FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage hotel types" ON public.hotel_types FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_hotel_types_updated BEFORE UPDATE ON public.hotel_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ROOM TYPES ============
CREATE TABLE public.room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.room_types TO anon, authenticated;
GRANT ALL ON public.room_types TO service_role;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active room types" ON public.room_types FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage room types" ON public.room_types FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_room_types_updated BEFORE UPDATE ON public.room_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MEAL PLANS ============
CREATE TABLE public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meal_plans TO anon, authenticated;
GRANT ALL ON public.meal_plans TO service_role;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active meal plans" ON public.meal_plans FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage meal plans" ON public.meal_plans FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_meal_plans_updated BEFORE UPDATE ON public.meal_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AMENITIES ============
CREATE TABLE public.amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.amenities TO anon, authenticated;
GRANT ALL ON public.amenities TO service_role;
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active amenities" ON public.amenities FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage amenities" ON public.amenities FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_amenities_updated BEFORE UPDATE ON public.amenities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ORGANIZER TYPES ============
CREATE TABLE public.organizer_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizer_types TO anon, authenticated;
GRANT ALL ON public.organizer_types TO service_role;
ALTER TABLE public.organizer_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active organizer types" ON public.organizer_types FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage organizer types" ON public.organizer_types FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_organizer_types_updated BEFORE UPDATE ON public.organizer_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEED DATA ============
INSERT INTO public.countries (code, name_en, name_ar) VALUES
  ('SA','Saudi Arabia','المملكة العربية السعودية'),
  ('EG','Egypt','مصر'),
  ('AE','United Arab Emirates','الإمارات العربية المتحدة'),
  ('QA','Qatar','قطر'),
  ('BH','Bahrain','البحرين'),
  ('KW','Kuwait','الكويت'),
  ('OM','Oman','عُمان'),
  ('JO','Jordan','الأردن'),
  ('TR','Turkey','تركيا');

INSERT INTO public.cities (country_id, name_en, name_ar)
SELECT c.id, v.en, v.ar FROM public.countries c
JOIN (VALUES
  ('SA','Makkah','مكة المكرمة'),
  ('SA','Madinah','المدينة المنورة'),
  ('SA','Jeddah','جدة'),
  ('SA','Riyadh','الرياض'),
  ('SA','Dammam','الدمام'),
  ('SA','Taif','الطائف'),
  ('EG','Cairo','القاهرة'),
  ('EG','Alexandria','الإسكندرية'),
  ('EG','Giza','الجيزة'),
  ('AE','Abu Dhabi','أبو ظبي'),
  ('QA','Doha','الدوحة'),
  ('BH','Manama','المنامة'),
  ('KW','Kuwait City','مدينة الكويت'),
  ('OM','Muscat','مسقط'),
  ('JO','Amman','عمّان'),
  ('TR','Ankara','أنقرة')
) AS v(code, en, ar) ON v.code = c.code;

INSERT INTO public.hotel_types (name_en, name_ar) VALUES
  ('Hotel','فندق'),
  ('Hotel Apartments','شقق فندقية'),
  ('Resort','منتجع'),
  ('Hostel','بيت شباب'),
  ('Serviced Apartments','شقق مخدومة'),
  ('Boutique Hotel','فندق بوتيك');

INSERT INTO public.room_types (name_en, name_ar) VALUES
  ('Single','فردية'),
  ('Double','مزدوجة'),
  ('Triple','ثلاثية'),
  ('Quad','رباعية'),
  ('Suite','جناح'),
  ('Family Room','غرفة عائلية');

INSERT INTO public.meal_plans (name_en, name_ar) VALUES
  ('Room Only','الغرفة فقط'),
  ('Breakfast','إفطار'),
  ('Half Board','نصف إقامة'),
  ('Full Board','إقامة كاملة'),
  ('All Inclusive','شامل');

INSERT INTO public.amenities (name_en, name_ar) VALUES
  ('WiFi','واي فاي'),
  ('Parking','موقف سيارات'),
  ('Restaurant','مطعم'),
  ('Meeting Rooms','قاعات اجتماعات'),
  ('Airport Transfer','نقل من وإلى المطار'),
  ('Laundry','مغسلة'),
  ('Gym','صالة رياضية'),
  ('Pool','مسبح'),
  ('Business Center','مركز أعمال');

INSERT INTO public.organizer_types (name_en, name_ar) VALUES
  ('Umrah Company','شركة عمرة'),
  ('Hajj Company','شركة حج'),
  ('Tourism Agency','وكالة سياحية'),
  ('Corporate Client','عميل مؤسسي'),
  ('Government Organization','جهة حكومية'),
  ('Sports Team','فريق رياضي'),
  ('Educational Institution','مؤسسة تعليمية'),
  ('Event Organizer','منظم فعاليات');

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
