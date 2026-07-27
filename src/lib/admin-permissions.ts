export const ADMIN_PERMISSION_KEYS = [
  "manage_hotels",
  "manage_agencies",
  "manage_rfqs",
  "manage_quotations",
  "manage_bookings",
  "manage_messages",
  "manage_notifications",
  "manage_users",
  "manage_roles",
  "manage_approvals",
  "manage_subscriptions",
  "manage_payments",
  "view_reports",
  "view_analytics",
  "manage_settings",
  "manage_system_configuration",
  "manage_audit_logs",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSION_KEYS)[number];
export type EnterpriseAdminRole = "super_admin" | "admin" | "assistant_admin";

export type AdminAccess = {
  accessLevel: number;
  isAdmin: boolean;
  permissions: AdminPermission[];
  role: EnterpriseAdminRole | null;
  roleName: string | null;
};

export const EMPTY_ADMIN_ACCESS: AdminAccess = {
  accessLevel: 0,
  isAdmin: false,
  permissions: [],
  role: null,
  roleName: null,
};

export function isAdminPermission(value: unknown): value is AdminPermission {
  return ADMIN_PERMISSION_KEYS.includes(value as AdminPermission);
}

export function parseAdminAccess(value: unknown): AdminAccess {
  if (!value || typeof value !== "object") return EMPTY_ADMIN_ACCESS;
  const record = value as Record<string, unknown>;
  const role =
    record.role === "super_admin" || record.role === "admin" || record.role === "assistant_admin"
      ? record.role
      : null;

  return {
    accessLevel: typeof record.access_level === "number" ? record.access_level : 0,
    isAdmin: record.is_admin === true,
    permissions: Array.isArray(record.permissions)
      ? record.permissions.filter(isAdminPermission)
      : [],
    role,
    roleName: typeof record.role_name === "string" ? record.role_name : null,
  };
}

export function hasAdminPermission(access: AdminAccess | undefined, permission: AdminPermission) {
  return access?.permissions.includes(permission) ?? false;
}
