
CREATE OR REPLACE FUNCTION public.restrict_profile_company_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.company_name IS DISTINCT FROM OLD.company_name
     OR NEW.vat_number IS DISTINCT FROM OLD.vat_number
     OR NEW.cr_number IS DISTINCT FROM OLD.cr_number THEN
    RAISE EXCEPTION 'Company name, VAT number, and CR number cannot be changed. Please contact support.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_profile_company_fields ON public.profiles;
CREATE TRIGGER trg_restrict_profile_company_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.restrict_profile_company_fields();
