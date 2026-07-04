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
);