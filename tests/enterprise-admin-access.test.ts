import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_PERMISSION_KEYS,
  EMPTY_ADMIN_ACCESS,
  hasAdminPermission,
  parseAdminAccess,
} from "../src/lib/admin-permissions";

describe("enterprise admin access", () => {
  it("parses only supported roles and permission keys", () => {
    const access = parseAdminAccess({
      access_level: 50,
      is_admin: true,
      permissions: ["manage_approvals", "unknown_permission"],
      role: "assistant_admin",
      role_name: "Assistant Admin",
    });

    expect(access).toEqual({
      accessLevel: 50,
      isAdmin: true,
      permissions: ["manage_approvals"],
      role: "assistant_admin",
      roleName: "Assistant Admin",
    });
    expect(hasAdminPermission(access, "manage_approvals")).toBe(true);
    expect(hasAdminPermission(access, "manage_roles")).toBe(false);
  });

  it("fails closed for malformed access payloads", () => {
    expect(parseAdminAccess(null)).toEqual(EMPTY_ADMIN_ACCESS);
    expect(parseAdminAccess({ role: "owner", permissions: "all" })).toEqual({
      ...EMPTY_ADMIN_ACCESS,
      roleName: null,
    });
  });

  it("keeps the permission catalog stable and unique", () => {
    expect(new Set(ADMIN_PERMISSION_KEYS).size).toBe(ADMIN_PERMISSION_KEYS.length);
    expect(ADMIN_PERMISSION_KEYS).toContain("manage_approvals");
    expect(ADMIN_PERMISSION_KEYS).toContain("manage_roles");
    expect(ADMIN_PERMISSION_KEYS).toContain("manage_system_configuration");
  });
});

describe("enterprise administration migration", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20260727120000_enterprise_admin_approval_center.sql",
    ),
    "utf8",
  );
  const grantsMigration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260727123000_harden_enterprise_admin_grants.sql"),
    "utf8",
  );

  it("protects authorization RPCs and the audit trail", () => {
    expect(migration).toContain("Permission denied: manage_roles is required");
    expect(migration).toContain("Permission denied: manage_approvals is required");
    expect(migration).toContain("Legacy Super Admin assignments cannot be downgraded");
    expect(migration).toContain("GRANT SELECT ON public.admin_audit_logs TO authenticated");
    expect(grantsMigration).toContain("REVOKE INSERT, UPDATE, DELETE");
    expect(grantsMigration).toContain("public.admin_audit_logs");
    expect(grantsMigration).toContain("FROM authenticated");
  });

  it("enforces permissions in database policies", () => {
    expect(migration).toContain("public.has_permission(auth.uid(), 'manage_users')");
    expect(migration).toContain("public.has_permission(auth.uid(), 'manage_approvals')");
    expect(migration).toContain("public.has_permission(auth.uid(), 'manage_rfqs')");
    expect(migration).toContain("public.has_permission(auth.uid(), 'manage_hotels')");
  });
});
