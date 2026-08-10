import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260810120000_deal_offer_workflow.sql"),
  "utf8",
);
const fixtures = readFileSync(resolve("supabase/tests/deal-offer-fixtures.sql"), "utf8");

describe("Deal and Offer workflow", () => {
  it("exposes only narrow lifecycle commands", () => {
    for (const command of [
      "accept_deal_offer",
      "reject_deal_offer",
      "withdraw_deal_offer",
      "expire_deal_offer",
      "cancel_deal",
      "close_deal",
    ]) {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION public.${command}`);
      expect(migration).toContain(
        `GRANT EXECUTE ON FUNCTION public.${command}(uuid) TO authenticated`,
      );
      expect(migration).toContain(
        `REVOKE ALL ON FUNCTION public.${command}(uuid) FROM PUBLIC, anon`,
      );
    }

    expect(migration).not.toMatch(
      /GRANT\s+(?:UPDATE|DELETE|ALL)[^;]*(?:deals|offers)[^;]*authenticated/iu,
    );
  });

  it("serializes acceptance and enforces one winner at the database boundary", () => {
    expect(migration).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_one_accepted_per_deal",
    );
    expect(migration).toContain("WHERE status = 'accepted'");
    expect(migration).toMatch(/FROM public\.deals deal[\s\S]*FOR UPDATE;/u);
    expect(migration).toMatch(/FROM public\.offers offer[\s\S]*FOR UPDATE;/u);
    expect(migration).toContain("'competing_offer_accepted'");
    expect(migration).toContain("'idempotent', true");
    expect(fixtures).toContain("workflow_concurrency_invariant");
  });

  it("keeps authority organization-based and platform admins inspection-only", () => {
    expect(migration).toContain("public.is_active_organization_member");
    expect(migration).toContain("public.user_organization_role");
    expect(migration).toContain("NOT IN ('owner', 'admin', 'agent')");
    expect(migration).toContain("NOT IN ('owner', 'admin', 'sales', 'reservations')");
    expect(migration).not.toContain("public.is_enterprise_admin");
    expect(fixtures).toContain("Platform Admin received marketplace acceptance authority");
  });

  it("writes lifecycle evidence to the canonical audit table in the command transaction", () => {
    expect(migration).toContain("INSERT INTO public.admin_audit_logs");
    expect(migration).toContain("public.record_deal_offer_transition");
    expect(migration).toContain("_entity_type || '.status_changed'");
    expect(fixtures).toContain("workflow_atomic_rollback");
    expect(fixtures).toContain("Fixture forced audit failure");
  });

  it("does not mutate or replace any V2 workflow", () => {
    expect(migration).not.toMatch(
      /(?:INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE) public\.(?:rfqs|rfq_invitations|quotes|bookings|hotels|conversations|messages|notifications)\b/iu,
    );
    expect(fixtures).toContain("workflow_terminal_deal");
    expect(fixtures).toContain("v2_compatibility");
  });
});
