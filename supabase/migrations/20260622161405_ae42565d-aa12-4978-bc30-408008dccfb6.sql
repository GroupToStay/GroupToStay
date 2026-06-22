
-- Make the public view run with the caller's permissions (security_invoker)
ALTER VIEW public.hotels_public SET (security_invoker = on);

-- Restore the public read of approved hotels (needed by the view under security_invoker)
CREATE POLICY "Approved hotels public"
ON public.hotels FOR SELECT
TO anon, authenticated
USING (status = 'approved'::hotel_status);

-- Remove the duplicate authenticated-only policy added in the previous migration
DROP POLICY IF EXISTS "Approved hotels visible to authenticated" ON public.hotels;

-- Stop anonymous visitors from reading owner_id on the base table.
-- Authenticated owners/admins keep full access via their own policies.
REVOKE SELECT ON public.hotels FROM anon;
GRANT SELECT (id, name, slug, city, country, address, lat, lng, star_rating,
              description, amenities, cover_image, gallery, status, featured,
              created_at, updated_at, country_id, city_id, hotel_type_id, archived)
ON public.hotels TO anon;
