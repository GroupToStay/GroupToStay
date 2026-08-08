
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('organizer', 'hotel', 'admin');
CREATE TYPE public.group_type AS ENUM ('umrah','hajj','tourism','corporate','government','sports','education','event','other');
CREATE TYPE public.board_type AS ENUM ('room_only','breakfast','half_board','full_board');
CREATE TYPE public.rfq_status AS ENUM ('draft','open','closed','awarded','cancelled');
CREATE TYPE public.invitation_status AS ENUM ('pending','viewed','quoted','declined');
CREATE TYPE public.quote_status AS ENUM ('submitted','shortlisted','accepted','rejected','withdrawn');
CREATE TYPE public.hotel_status AS ENUM ('pending','approved','suspended');
CREATE TYPE public.booking_status AS ENUM ('confirmed','cancelled','completed');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, org_name TEXT, phone TEXT, country TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER_ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- HANDLE NEW USER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, org_name, phone, country, locale)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'org_name',
          NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'country',
          COALESCE(NEW.raw_user_meta_data->>'locale','en'));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'organizer'));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- HOTELS
CREATE TABLE public.hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL, country TEXT NOT NULL, address TEXT,
  lat NUMERIC, lng NUMERIC,
  star_rating INT CHECK (star_rating BETWEEN 1 AND 5),
  description TEXT, amenities TEXT[] NOT NULL DEFAULT '{}',
  cover_image TEXT, gallery TEXT[] NOT NULL DEFAULT '{}',
  status public.hotel_status NOT NULL DEFAULT 'pending',
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hotels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotels TO authenticated;
GRANT ALL ON public.hotels TO service_role;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved hotels public" ON public.hotels FOR SELECT TO anon, authenticated USING (status = 'approved');
CREATE POLICY "Owner views own hotel" ON public.hotels FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admin views all hotels" ON public.hotels FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Hotel owners create hotels" ON public.hotels FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(),'hotel'));
CREATE POLICY "Owner updates hotel" ON public.hotels FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admin updates hotel" ON public.hotels FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin deletes hotel" ON public.hotels FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER hotels_updated BEFORE UPDATE ON public.hotels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX hotels_city_idx ON public.hotels(city);
CREATE INDEX hotels_status_idx ON public.hotels(status);

-- HOTEL ROOMS
CREATE TABLE public.hotel_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_type TEXT NOT NULL, capacity INT NOT NULL DEFAULT 2,
  count_available INT NOT NULL DEFAULT 0,
  base_price NUMERIC NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hotel_rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_rooms TO authenticated;
GRANT ALL ON public.hotel_rooms TO service_role;
ALTER TABLE public.hotel_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rooms public if hotel approved" ON public.hotel_rooms FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.status='approved'));
CREATE POLICY "Owner manages rooms" ON public.hotel_rooms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()));

-- RFQs
CREATE TABLE public.rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  group_type public.group_type NOT NULL DEFAULT 'other',
  destination_city TEXT NOT NULL, destination_country TEXT NOT NULL,
  check_in DATE NOT NULL, check_out DATE NOT NULL,
  nights INT GENERATED ALWAYS AS (GREATEST((check_out - check_in)::int, 0)) STORED,
  guests_count INT NOT NULL DEFAULT 1, rooms_needed INT NOT NULL DEFAULT 1,
  room_type_pref TEXT, board_type public.board_type NOT NULL DEFAULT 'breakfast',
  budget_min NUMERIC, budget_max NUMERIC, currency TEXT NOT NULL DEFAULT 'USD',
  special_requirements TEXT,
  status public.rfq_status NOT NULL DEFAULT 'open',
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfqs TO authenticated;
GRANT ALL ON public.rfqs TO service_role;
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizer manages own RFQ" ON public.rfqs FOR ALL TO authenticated
  USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "Admin views all RFQs" ON public.rfqs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER rfqs_updated BEFORE UPDATE ON public.rfqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RFQ INVITATIONS
CREATE TABLE public.rfq_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rfq_id, hotel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_invitations TO authenticated;
GRANT ALL ON public.rfq_invitations TO service_role;
ALTER TABLE public.rfq_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizer sees own RFQ invites" ON public.rfq_invitations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_id AND r.organizer_id = auth.uid()));
CREATE POLICY "Hotel owner sees own invites" ON public.rfq_invitations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()));
CREATE POLICY "Hotel owner updates own invites" ON public.rfq_invitations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()));
CREATE POLICY "Admin sees all invites" ON public.rfq_invitations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Invited hotel views RFQ" ON public.rfqs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rfq_invitations i JOIN public.hotels h ON h.id = i.hotel_id
    WHERE i.rfq_id = rfqs.id AND h.owner_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.match_rfq_to_hotels()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'open' THEN
    INSERT INTO public.rfq_invitations (rfq_id, hotel_id)
    SELECT NEW.id, h.id FROM public.hotels h
    WHERE h.status='approved' AND lower(h.city) = lower(NEW.destination_city)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER rfq_match_after_insert AFTER INSERT ON public.rfqs FOR EACH ROW EXECUTE FUNCTION public.match_rfq_to_hotels();

-- QUOTES
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  total_price NUMERIC NOT NULL,
  price_per_room_night NUMERIC, currency TEXT NOT NULL DEFAULT 'USD',
  board_included public.board_type NOT NULL DEFAULT 'breakfast',
  inclusions TEXT, valid_until DATE, notes TEXT,
  status public.quote_status NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hotel owner manages own quotes" ON public.quotes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()));
CREATE POLICY "Organizer views quotes on own RFQ" ON public.quotes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_id AND r.organizer_id = auth.uid()));
CREATE POLICY "Organizer updates quote status on own RFQ" ON public.quotes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_id AND r.organizer_id = auth.uid()));
CREATE POLICY "Admin views all quotes" ON public.quotes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER quotes_updated BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sender or recipient views message" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Sender sends message" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- BOOKINGS
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  total_amount NUMERIC NOT NULL, commission_amount NUMERIC NOT NULL DEFAULT 0,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  contract_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizer views own booking" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = organizer_id);
CREATE POLICY "Hotel owner views own booking" ON public.bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()));
CREATE POLICY "Organizer creates booking" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "Admin views all bookings" ON public.bookings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PLATFORM SETTINGS
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads settings" ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manages settings" ON public.platform_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.platform_settings (key, value) VALUES
  ('commission_percent', '10'::jsonb),
  ('featured_listing_price_usd', '199'::jsonb);
