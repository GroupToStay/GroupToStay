
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_rfq_to_hotels() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
ALTER TABLE public.hotels ALTER COLUMN owner_id DROP NOT NULL;-- 1) user_roles: restrict INSERT/UPDATE/DELETE to admins only
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) bookings: add UPDATE/DELETE policies
CREATE POLICY "Admin updates bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Organizer updates own booking" ON public.bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Hotel owner updates own booking" ON public.bookings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = bookings.hotel_id AND h.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = bookings.hotel_id AND h.owner_id = auth.uid()));

CREATE POLICY "Admin deletes bookings" ON public.bookings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) messages: scope UPDATE/DELETE to sender
CREATE POLICY "Sender updates own message" ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Sender deletes own message" ON public.messages
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- 4) rfq_invitations: restrict INSERT/DELETE
CREATE POLICY "Admin inserts invites" ON public.rfq_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Organizer invites on own RFQ" ON public.rfq_invitations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_invitations.rfq_id AND r.organizer_id = auth.uid()));

CREATE POLICY "Admin deletes invites" ON public.rfq_invitations
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Organizer deletes own RFQ invites" ON public.rfq_invitations
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_invitations.rfq_id AND r.organizer_id = auth.uid()));

-- 5) quotes: restrict organizer UPDATE to status field only via trigger
DROP POLICY IF EXISTS "Organizer updates quote status on own RFQ" ON public.quotes;

CREATE POLICY "Organizer updates quote status on own RFQ" ON public.quotes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = quotes.rfq_id AND r.organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = quotes.rfq_id AND r.organizer_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.restrict_organizer_quote_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = NEW.hotel_id AND h.owner_id = auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.total_price       IS DISTINCT FROM OLD.total_price
   OR NEW.price_per_room_night IS DISTINCT FROM OLD.price_per_room_night
   OR NEW.currency         IS DISTINCT FROM OLD.currency
   OR NEW.board_included   IS DISTINCT FROM OLD.board_included
   OR NEW.valid_until      IS DISTINCT FROM OLD.valid_until
   OR NEW.inclusions       IS DISTINCT FROM OLD.inclusions
   OR NEW.notes            IS DISTINCT FROM OLD.notes
   OR NEW.rfq_id           IS DISTINCT FROM OLD.rfq_id
   OR NEW.hotel_id         IS DISTINCT FROM OLD.hotel_id
  THEN
    RAISE EXCEPTION 'Organizers may only update quote status';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restrict_organizer_quote_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_restrict_organizer_quote_updates ON public.quotes;
CREATE TRIGGER trg_restrict_organizer_quote_updates
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.restrict_organizer_quote_updates();

-- 6) Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_rfq_to_hotels() FROM PUBLIC, anon, authenticated;REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
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

DROP POLICY IF EXISTS "Hotel photos public read" ON storage.objects;
CREATE POLICY "Hotel photos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'hotel-photos');

DROP POLICY IF EXISTS "Hotel owner upload" ON storage.objects;
CREATE POLICY "Hotel owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hotel-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.has_role(auth.uid(), 'hotel')
  );

DROP POLICY IF EXISTS "Hotel owner update" ON storage.objects;
CREATE POLICY "Hotel owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'hotel-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Hotel owner delete" ON storage.objects;
CREATE POLICY "Hotel owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'hotel-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

REVOKE EXECUTE ON FUNCTION public.is_hotel_profile_approved(uuid) FROM PUBLIC, anon;

-- 1) Tighten bookings INSERT to prevent referencing other organizers' RFQs/quotes
DROP POLICY IF EXISTS "Organizer creates booking" ON public.bookings;
CREATE POLICY "Organizer creates booking" ON public.bookings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = organizer_id
  AND EXISTS (
    SELECT 1 FROM public.rfqs r
    WHERE r.id = bookings.rfq_id AND r.organizer_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = bookings.quote_id
      AND q.rfq_id = bookings.rfq_id
      AND q.hotel_id = bookings.hotel_id
  )
);

-- 2) Tighten messages INSERT so only RFQ participants can post in a thread
DROP POLICY IF EXISTS "Sender sends message" ON public.messages;
CREATE POLICY "Sender sends message" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (
    EXISTS (
      SELECT 1 FROM public.rfqs r
      WHERE r.id = messages.rfq_id AND r.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.rfq_invitations i
      JOIN public.hotels h ON h.id = i.hotel_id
      WHERE i.rfq_id = messages.rfq_id AND h.owner_id = auth.uid()
    )
  )
);

-- 3) Remove organizer self-invite on rfq_invitations; matching is handled by
--    the system trigger match_rfq_to_hotels and by admins.
DROP POLICY IF EXISTS "Organizer invites on own RFQ" ON public.rfq_invitations;

-- 4) Revoke EXECUTE on SECURITY DEFINER helpers from anon/PUBLIC.
--    They remain available to `authenticated` because RLS policies invoke
--    them during query evaluation as the current role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_hotel_profile_approved(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_rfq_to_hotels() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_organizer_quote_updates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Restrict listing of hotel-photos by requiring the request to ask for a specific object name prefix.
DROP POLICY IF EXISTS "Hotel photos public read" ON storage.objects;
CREATE POLICY "Hotel photos public read" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'hotel-photos'
  AND coalesce(((current_setting('request.headers', true))::json ->> 'prefer'), '') NOT LIKE '%list%'
);

CREATE OR REPLACE FUNCTION public.restrict_profile_company_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.company_name IS DISTINCT FROM OLD.company_name
     OR NEW.vat_number IS DISTINCT FROM OLD.vat_number
     OR NEW.cr_number IS DISTINCT FROM OLD.cr_number THEN
    RAISE EXCEPTION 'Company name, VAT number, and CR number cannot be changed. Please contact support.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_profile_company_fields ON public.profiles;
CREATE TRIGGER trg_restrict_profile_company_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.restrict_profile_company_fields();
REVOKE EXECUTE ON FUNCTION public.restrict_profile_company_fields() FROM PUBLIC, anon, authenticated;
-- Make open RFQs publicly browsable, and allow hotels to message the organizer about open RFQs.

CREATE POLICY "Anyone views open RFQs"
ON public.rfqs
FOR SELECT
USING (status = 'open');

GRANT SELECT ON public.rfqs TO anon;
GRANT SELECT ON public.rfqs TO authenticated;

-- Allow hotel users to message the organizer of any open RFQ (even without an invitation).
CREATE POLICY "Hotel messages organizer on open RFQ"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.has_role(auth.uid(), 'hotel')
  AND EXISTS (
    SELECT 1 FROM public.rfqs r
    WHERE r.id = messages.rfq_id
      AND r.status = 'open'
      AND r.organizer_id = messages.recipient_id
  )
);

-- Allow organizer to reply to any hotel that contacted them about their RFQ.
CREATE POLICY "Organizer replies to any hotel about own RFQ"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.rfqs r
    WHERE r.id = messages.rfq_id
      AND r.organizer_id = auth.uid()
  )
);
-- Clean up: remove non-admin roles from admin users
DELETE FROM public.user_roles ur
WHERE ur.role <> 'admin'
  AND EXISTS (
    SELECT 1 FROM public.user_roles a
    WHERE a.user_id = ur.user_id AND a.role = 'admin'
  );

-- Trigger: when an admin role is inserted, remove the user's other roles
CREATE OR REPLACE FUNCTION public.enforce_admin_exclusive_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id AND role <> 'admin';
  ELSE
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'admin') THEN
      RAISE EXCEPTION 'Admin users cannot have additional roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_admin_exclusive_role_trg ON public.user_roles;
CREATE TRIGGER enforce_admin_exclusive_role_trg
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_exclusive_role();

CREATE OR REPLACE FUNCTION public.is_rfq_organizer(_rfq_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rfqs WHERE id = _rfq_id AND organizer_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_hotel_invited_to_rfq(_rfq_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rfq_invitations i
    JOIN public.hotels h ON h.id = i.hotel_id
    WHERE i.rfq_id = _rfq_id AND h.owner_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "Invited hotel views RFQ" ON public.rfqs;
CREATE POLICY "Invited hotel views RFQ" ON public.rfqs
  FOR SELECT USING (public.is_hotel_invited_to_rfq(id, auth.uid()));

DROP POLICY IF EXISTS "Organizer sees own RFQ invites" ON public.rfq_invitations;
CREATE POLICY "Organizer sees own RFQ invites" ON public.rfq_invitations
  FOR SELECT USING (public.is_rfq_organizer(rfq_id, auth.uid()));

DROP POLICY IF EXISTS "Organizer deletes own RFQ invites" ON public.rfq_invitations;
CREATE POLICY "Organizer deletes own RFQ invites" ON public.rfq_invitations
  FOR DELETE USING (public.is_rfq_organizer(rfq_id, auth.uid()));

DROP POLICY IF EXISTS "Organizer views quotes on own RFQ" ON public.quotes;
CREATE POLICY "Organizer views quotes on own RFQ" ON public.quotes
  FOR SELECT USING (public.is_rfq_organizer(rfq_id, auth.uid()));

DROP POLICY IF EXISTS "Organizer updates quote status on own RFQ" ON public.quotes;
CREATE POLICY "Organizer updates quote status on own RFQ" ON public.quotes
  FOR UPDATE USING (public.is_rfq_organizer(rfq_id, auth.uid()))
  WITH CHECK (public.is_rfq_organizer(rfq_id, auth.uid()));
