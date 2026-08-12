import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260809170000_organization_membership_foundation.sql"),
  "utf8",
);
const reconstruction = readFileSync(resolve("scripts/run-database-reconstruction.mjs"), "utf8");

describe("organization and membership foundation", () => {
  it("keeps legacy ownership additive and deterministic", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.organizations");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.organization_memberships");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.organization_hotel_mappings");
    expect(migration).toContain("public.legacy_organization_id");
    expect(migration).toContain("ON CONFLICT (organization_id, user_id) DO NOTHING");
    expect(migration).not.toMatch(/ALTER TABLE public\.(rfqs|quotes|bookings|conversations)\b/iu);
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN)\b/iu);
  });

  it("skips blank profile fields when deriving an organization display name", () => {
    expect(migration).toContain("NULLIF(btrim(profile.trade_name), '')");
    expect(migration).toContain("NULLIF(btrim(profile.company_name), '')");
    expect(migration).toContain("NULLIF(btrim(profile.full_name), '')");
    expect(migration).toContain("ELSE 'Supplier account' END");
  });

  it("keeps platform and organization authority separate", () => {
    expect(migration).toContain("public.organization_membership_role");
    expect(migration).toContain("public.validate_organization_membership_role");
    expect(migration).toContain("public.is_active_organization_member");
    expect(migration).toContain("public.user_organization_role");
    expect(migration).toContain("public.can_manage_organization");
    expect(migration).toContain("public.is_enterprise_admin(auth.uid())");
    expect(migration).toContain("Platform and marketplace roles cannot be conflated");
  });

  it("does not grant ordinary users a membership mutation path", () => {
    expect(migration).toContain(
      "REVOKE ALL ON public.organization_memberships FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain("GRANT SELECT ON public.organization_memberships TO authenticated");
    expect(migration).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[^;]*organization_memberships[^;]*authenticated/iu,
    );
  });

  it("makes RLS and behavioral fixtures reconstruction-blocking", () => {
    expect(migration).toContain("ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain(
      "ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY",
    );
    expect(reconstruction).toContain('"supabase/tests/organization-membership-fixtures.sql"');
    expect(reconstruction).toContain("organizationMembershipFixtures");
  });

  it("reuses the existing append-only admin audit infrastructure", () => {
    expect(migration).toContain("INSERT INTO public.admin_audit_logs");
    expect(migration).toContain("organization.created");
    expect(migration).toContain("organization_membership.role_changed");
    expect(migration).toContain("organization_membership.suspended");
    expect(migration).toContain("organization_membership.removed");
  });
});
