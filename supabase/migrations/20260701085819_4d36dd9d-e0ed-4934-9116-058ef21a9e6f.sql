
-- 1) Column-level lockdown of approval fields on profiles
REVOKE UPDATE (hotel_approval_status, approved_by, approved_at, approval_notes)
  ON public.profiles FROM authenticated, anon;

-- Ensure other columns remain updatable by authenticated users (self-update policy still applies).
-- (No GRANT needed; existing table-level GRANT covers non-revoked columns.)

-- 2) Storage: SELECT policy for hotel-photos limited to approved hotels
DROP POLICY IF EXISTS "Hotel photos public read approved" ON storage.objects;
CREATE POLICY "Hotel photos public read approved"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'hotel-photos'
  AND EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.status = 'approved'
      AND h.owner_id::text = (storage.foldername(name))[1]
  )
);

-- Owners/admins can still read their own files regardless of approval
DROP POLICY IF EXISTS "Hotel photos owner read" ON storage.objects;
CREATE POLICY "Hotel photos owner read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'hotel-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);
