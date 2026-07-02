-- Admin management page support.
-- Keeps pages admin-only through existing /admin route guard and Supabase RLS.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'suspended', 'disabled'));

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles(account_status);

CREATE OR REPLACE FUNCTION public.prevent_non_admin_account_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change account status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_non_admin_account_status_change ON public.profiles;
CREATE TRIGGER trg_prevent_non_admin_account_status_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_non_admin_account_status_change();

DROP POLICY IF EXISTS "Admin updates all RFQs" ON public.rfqs;
CREATE POLICY "Admin updates all RFQs"
ON public.rfqs
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin deletes all RFQs" ON public.rfqs;
CREATE POLICY "Admin deletes all RFQs"
ON public.rfqs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
