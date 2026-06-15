-- Clean up: remove non-admin roles from admin users
DELETE FROM public.user_roles ur
WHERE ur.role <> 'admin'
  AND EXISTS (
    SELECT 1 FROM public.user_roles a
    WHERE a.user_id = ur.user_id AND a.role = 'admin'
  );

-- Trigger: when an admin role is inserted, remove the user's other roles
CREATE OR REPLACE FUNCTION public.enforce_admin_exclusive_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id AND role <> 'admin';
  ELSE
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'admin') THEN
      RAISE EXCEPTION 'Admin users cannot have additional roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_admin_exclusive_role_trg ON public.user_roles;
CREATE TRIGGER enforce_admin_exclusive_role_trg
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_exclusive_role();
