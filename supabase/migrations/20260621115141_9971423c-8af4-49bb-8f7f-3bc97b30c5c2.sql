-- Restrict admin-management policies to authenticated role so anon never evaluates has_role()
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname='public'
             AND tablename IN ('countries','cities','hotel_types','room_types','meal_plans','amenities','organizer_types')
             AND policyname ILIKE 'Admins manage%'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Belt-and-suspenders: allow anon/authenticated to execute has_role (security definer, safe)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;