
DROP VIEW IF EXISTS public.unmapped_locations;
CREATE VIEW public.unmapped_locations
WITH (security_invoker = true) AS
SELECT 'hotel'::text AS record_type, id AS record_id, name AS label, country AS country_text, city AS city_text
FROM public.hotels WHERE country_id IS NULL OR city_id IS NULL
UNION ALL
SELECT 'rfq', id, title, destination_country, destination_city
FROM public.rfqs WHERE destination_country_id IS NULL OR destination_city_id IS NULL;
REVOKE ALL ON public.unmapped_locations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.unmapped_locations TO authenticated;
