
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
