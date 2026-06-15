
-- Restrict listing of hotel-photos by requiring the request to ask for a specific object name prefix.
DROP POLICY IF EXISTS "Hotel photos public read" ON storage.objects;
CREATE POLICY "Hotel photos public read" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'hotel-photos'
  AND coalesce(((current_setting('request.headers', true))::json ->> 'prefer'), '') NOT LIKE '%list%'
);
