REVOKE EXECUTE ON FUNCTION public.require_verified_agency_for_invitation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.require_verified_agency_for_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_conversation_participant_updates() FROM PUBLIC, anon, authenticated;