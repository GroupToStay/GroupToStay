
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
