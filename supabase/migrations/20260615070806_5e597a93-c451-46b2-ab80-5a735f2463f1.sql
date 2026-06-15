
-- Approval status for hotel companies
DO $$ BEGIN
  CREATE TYPE public.hotel_approval_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.id_doc_type AS ENUM ('saudi_id','iqama');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS cr_number text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS id_type public.id_doc_type,
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS hotel_approval_status public.hotel_approval_status,
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- Admin policies on profiles
DROP POLICY IF EXISTS "Admin views all profiles" ON public.profiles;
CREATE POLICY "Admin views all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin updates profiles" ON public.profiles;
CREATE POLICY "Admin updates profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Replace handle_new_user to capture new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'organizer');
BEGIN
  INSERT INTO public.profiles (
    id, full_name, org_name, phone, country, locale,
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
END; $function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: is hotel profile approved?
CREATE OR REPLACE FUNCTION public.is_hotel_profile_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND hotel_approval_status = 'approved'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_hotel_profile_approved(uuid) TO authenticated;

-- Replace hotels INSERT policy to require approved profile
DROP POLICY IF EXISTS "Hotel owners create hotels" ON public.hotels;
CREATE POLICY "Hotel owners create hotels" ON public.hotels
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND public.has_role(auth.uid(), 'hotel')
    AND public.is_hotel_profile_approved(auth.uid())
  );

-- Restrict RFQ creation to organizers (block hotels)
DROP POLICY IF EXISTS "Organizer manages own RFQ" ON public.rfqs;
CREATE POLICY "Organizer views own RFQ" ON public.rfqs
  FOR SELECT USING (auth.uid() = organizer_id);
CREATE POLICY "Organizer inserts own RFQ" ON public.rfqs
  FOR INSERT WITH CHECK (
    auth.uid() = organizer_id
    AND public.has_role(auth.uid(), 'organizer')
  );
CREATE POLICY "Organizer updates own RFQ" ON public.rfqs
  FOR UPDATE USING (auth.uid() = organizer_id);
CREATE POLICY "Organizer deletes own RFQ" ON public.rfqs
  FOR DELETE USING (auth.uid() = organizer_id);
