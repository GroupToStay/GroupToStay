
-- Profiles: split phone + country
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL;

-- Hotels: archived flag for suspended hotels detached from owners
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Lock approved company (profiles.hotel_approval_status) so once approved it stays approved
CREATE OR REPLACE FUNCTION public.lock_company_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.hotel_approval_status = 'approved'
     AND NEW.hotel_approval_status IS DISTINCT FROM 'approved'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Approved companies cannot change status';
  END IF;
  -- Even admins cannot move an approved company back to anything else
  IF OLD.hotel_approval_status = 'approved'
     AND NEW.hotel_approval_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Approved companies are locked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_company_approval ON public.profiles;
CREATE TRIGGER trg_lock_company_approval
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.lock_company_approval();

-- Lock approved hotel listings: once approved, cannot become pending/suspended
CREATE OR REPLACE FUNCTION public.lock_hotel_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'approved'
     AND NEW.status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Approved hotels are locked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_hotel_approval ON public.hotels;
CREATE TRIGGER trg_lock_hotel_approval
BEFORE UPDATE ON public.hotels
FOR EACH ROW EXECUTE FUNCTION public.lock_hotel_approval();

-- Subscription waitlist
CREATE TABLE IF NOT EXISTS public.subscription_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  hotel_name text,
  requested_plan text NOT NULL CHECK (requested_plan IN ('professional','featured')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','notified')),
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.subscription_interest TO authenticated;
GRANT ALL ON public.subscription_interest TO service_role;

ALTER TABLE public.subscription_interest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own interest" ON public.subscription_interest;
CREATE POLICY "Users insert own interest" ON public.subscription_interest
FOR INSERT TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own interest" ON public.subscription_interest;
CREATE POLICY "Users read own interest" ON public.subscription_interest
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update interest" ON public.subscription_interest;
CREATE POLICY "Admins update interest" ON public.subscription_interest
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed feature flag
INSERT INTO public.platform_settings (key, value)
VALUES ('subscriptions_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
