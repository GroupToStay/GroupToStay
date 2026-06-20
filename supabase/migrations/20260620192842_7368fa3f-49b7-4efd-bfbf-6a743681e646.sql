
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['countries','cities','hotel_types','room_types','meal_plans','amenities','organizer_types']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Anyone reads active %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Anyone reads active %1$s" ON public.%1$s FOR SELECT USING (is_active = true)', t);
    EXECUTE format('GRANT SELECT ON public.%1$s TO anon, authenticated', t);
  END LOOP;
END $$;
