
DROP POLICY IF EXISTS "Hotel photos public read approved" ON storage.objects;
CREATE POLICY "Hotel photos public read approved" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'hotel-photos'
  AND EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.status = 'approved'
      AND h.owner_id::text = (storage.foldername(storage.objects.name))[1]
  )
);-- Final hardening for the RFQ marketplace model.
-- Hotels and hotel inventory must not be browsable by visitors, agencies, or
-- unrelated hotels. Access is limited to admins, hotel owners, and organizers
-- who are tied to the hotel through their own RFQs/invitations/quotes.

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_amenities ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON TABLE public.hotels FROM PUBLIC, anon;
REVOKE SELECT ON TABLE public.hotel_rooms FROM PUBLIC, anon;
REVOKE SELECT ON TABLE public.hotel_amenities FROM PUBLIC, anon;

GRANT SELECT ON TABLE public.hotels TO authenticated;
GRANT SELECT ON TABLE public.hotel_rooms TO authenticated;
GRANT SELECT ON TABLE public.hotel_amenities TO authenticated;

DO $$
DECLARE
  rel text;
  selectable_columns text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['public.hotels', 'public.hotel_rooms', 'public.hotel_amenities']
  LOOP
    SELECT string_agg(quote_ident(attname), ', ')
    INTO selectable_columns
    FROM pg_attribute
    WHERE attrelid = rel::regclass
      AND attnum > 0
      AND NOT attisdropped
      AND has_column_privilege('anon', rel, attname, 'SELECT');

    IF selectable_columns IS NOT NULL THEN
      EXECUTE format('REVOKE SELECT (%s) ON %s FROM anon', selectable_columns, rel);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.hotels_public') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.hotels_public SET (security_invoker = on)';
    EXECUTE 'REVOKE SELECT ON public.hotels_public FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hotels'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hotels', p.policyname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.can_view_hotel_through_rfq(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.rfq_invitations i
        JOIN public.rfqs r ON r.id = i.rfq_id
        WHERE i.hotel_id = _hotel_id
          AND r.organizer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.quotes q
        JOIN public.rfqs r ON r.id = q.rfq_id
        WHERE q.hotel_id = _hotel_id
          AND r.organizer_id = auth.uid()
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_hotel_through_rfq(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_hotel_through_rfq(uuid) TO authenticated;

CREATE POLICY "Owner views own hotel"
ON public.hotels
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Admin views all hotels"
ON public.hotels
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Organizer views hotels tied to own RFQs"
ON public.hotels
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'organizer')
  AND public.can_view_hotel_through_rfq(hotels.id)
);

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hotel_rooms'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hotel_rooms', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Owner views own hotel rooms"
ON public.hotel_rooms
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.hotels h
    WHERE h.id = hotel_rooms.hotel_id
      AND h.owner_id = auth.uid()
  )
);

CREATE POLICY "Admin views all hotel rooms"
ON public.hotel_rooms
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Organizer views hotel rooms tied to own RFQs"
ON public.hotel_rooms
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'organizer')
  AND public.can_view_hotel_through_rfq(hotel_rooms.hotel_id)
);

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hotel_amenities'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hotel_amenities', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Owner views own hotel amenities"
ON public.hotel_amenities
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.hotels h
    WHERE h.id = hotel_amenities.hotel_id
      AND h.owner_id = auth.uid()
  )
);

CREATE POLICY "Admin views all hotel amenities"
ON public.hotel_amenities
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Organizer views hotel amenities tied to own RFQs"
ON public.hotel_amenities
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'organizer')
  AND public.can_view_hotel_through_rfq(hotel_amenities.hotel_id)
);

-- Hotel photos are marketplace data too. Keep the bucket private and allow
-- signed reads only to owners, admins, or organizers tied through RFQs.

DROP POLICY IF EXISTS "Hotel photos public read" ON storage.objects;
DROP POLICY IF EXISTS "Hotel photos public read approved" ON storage.objects;
DROP POLICY IF EXISTS "Hotel photos owner read" ON storage.objects;
DROP POLICY IF EXISTS "Hotel photos scoped read" ON storage.objects;

CREATE OR REPLACE FUNCTION public.can_view_hotel_photo(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH object_path AS (
    SELECT storage.foldername(_object_name) AS parts
  )
  SELECT auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (SELECT parts[1] FROM object_path) = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.hotels h
        WHERE h.owner_id::text = (SELECT parts[1] FROM object_path)
          AND h.id::text = (SELECT parts[2] FROM object_path)
          AND public.can_view_hotel_through_rfq(h.id)
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_hotel_photo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_hotel_photo(text) TO authenticated;

CREATE POLICY "Hotel photos scoped read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'hotel-photos'
  AND public.can_view_hotel_photo(name)
);
DROP POLICY IF EXISTS "Authenticated reads settings" ON public.platform_settings;
CREATE POLICY "Admins read settings" ON public.platform_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));-- Restrict conversation updates to read-tracking fields only for participants
CREATE OR REPLACE FUNCTION public.restrict_conversation_participant_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.rfq_id           IS DISTINCT FROM OLD.rfq_id
   OR NEW.quote_id        IS DISTINCT FROM OLD.quote_id
   OR NEW.hotel_id        IS DISTINCT FROM OLD.hotel_id
   OR NEW.organizer_id    IS DISTINCT FROM OLD.organizer_id
   OR NEW.hotel_owner_id  IS DISTINCT FROM OLD.hotel_owner_id
   OR NEW.created_at      IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Participants may only update read-tracking fields on conversations';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_conversation_participant_updates ON public.conversations;
CREATE TRIGGER trg_restrict_conversation_participant_updates
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.restrict_conversation_participant_updates();REVOKE EXECUTE ON FUNCTION public.require_verified_agency_for_invitation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.require_verified_agency_for_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_conversation_participant_updates() FROM PUBLIC, anon, authenticated;
