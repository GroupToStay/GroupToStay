
-- 1) Hotels: stop exposing owner_id to anon. Replace public anon policy with an authenticated-only policy, and create a public view that excludes owner_id for anon browsing.
DROP POLICY IF EXISTS "Approved hotels public" ON public.hotels;

CREATE POLICY "Approved hotels visible to authenticated"
ON public.hotels FOR SELECT
TO authenticated
USING (status = 'approved'::hotel_status);

CREATE OR REPLACE VIEW public.hotels_public AS
SELECT id, name, slug, city, country, address, lat, lng, star_rating,
       description, amenities, cover_image, gallery, status, featured,
       created_at, updated_at, country_id, city_id, hotel_type_id, archived
FROM public.hotels
WHERE status = 'approved'::hotel_status AND archived IS NOT TRUE;

GRANT SELECT ON public.hotels_public TO anon, authenticated;

-- 2) Conversations: explicit deny for client INSERTs (server trigger create_conversation_for_quote runs SECURITY DEFINER and bypasses RLS).
CREATE POLICY "Conversations created server-side only"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (false);

-- 3) Subscription interest: require user_id = auth.uid() so submissions cannot be orphaned.
DROP POLICY IF EXISTS "Users insert own interest" ON public.subscription_interest;
CREATE POLICY "Users insert own interest"
ON public.subscription_interest FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
