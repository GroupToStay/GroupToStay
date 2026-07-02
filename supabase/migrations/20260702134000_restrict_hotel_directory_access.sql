-- Restrict hotel directory access to protect the RFQ marketplace model.
-- Visitors cannot read hotel rows.
-- Hotels can read only their own hotel rows.
-- Organizers can read hotels only when tied to their own RFQs/invitations/quotes.
-- Admins retain full hotel visibility.

ALTER VIEW public.hotels_public SET (security_invoker = on);

REVOKE SELECT ON public.hotels FROM anon;

DO $$
DECLARE
  selectable_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ')
  INTO selectable_columns
  FROM pg_attribute
  WHERE attrelid = 'public.hotels'::regclass
    AND attnum > 0
    AND NOT attisdropped
    AND has_column_privilege('anon', 'public.hotels', attname, 'SELECT');

  IF selectable_columns IS NOT NULL THEN
    EXECUTE format('REVOKE SELECT (%s) ON public.hotels FROM anon', selectable_columns);
  END IF;
END $$;

REVOKE SELECT ON public.hotels_public FROM anon;
GRANT SELECT ON public.hotels_public TO authenticated;

DROP POLICY IF EXISTS "Approved hotels public" ON public.hotels;
DROP POLICY IF EXISTS "Approved hotels visible to authenticated" ON public.hotels;
DROP POLICY IF EXISTS "Organizer views hotels tied to own RFQs" ON public.hotels;

CREATE OR REPLACE FUNCTION public.can_view_hotel_through_rfq(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
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
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_hotel_through_rfq(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_hotel_through_rfq(uuid) TO authenticated;

CREATE POLICY "Organizer views hotels tied to own RFQs"
ON public.hotels
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'organizer')
  AND public.can_view_hotel_through_rfq(hotels.id)
);
