-- Enterprise administration writes are performed only through permission-checked RPCs.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.enterprise_roles,
  public.permissions,
  public.role_permissions,
  public.user_enterprise_roles,
  public.user_permission_overrides,
  public.admin_audit_logs
FROM authenticated;

GRANT SELECT
ON public.enterprise_roles,
  public.permissions,
  public.role_permissions,
  public.user_enterprise_roles,
  public.user_permission_overrides,
  public.admin_audit_logs
TO authenticated;
