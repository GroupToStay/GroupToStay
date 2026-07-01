
ALTER VIEW public.agencies_public SET (security_invoker = on);
REVOKE ALL ON FUNCTION public.require_verified_agency_for_rfq() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_verified_agency_for_conversation() FROM PUBLIC, anon, authenticated;
