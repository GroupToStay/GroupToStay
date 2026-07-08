
REVOKE EXECUTE ON FUNCTION public.is_account_active(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_non_admin_account_status_change() FROM anon, PUBLIC;
