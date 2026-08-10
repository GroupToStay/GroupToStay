import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260810170000_offer_revision_counteroffer_engine.sql"),
  "utf8",
);
const fixtures = readFileSync(resolve("supabase/tests/deal-offer-fixtures.sql"), "utf8");

describe("Offer Revision and Counteroffer Engine", () => {
  it("evolves Offers additively into immutable thread versions", () => {
    expect(migration).toContain("CREATE TABLE public.offer_threads");
    expect(migration).toContain("ALTER TABLE public.offers");
    expect(migration).toContain("ADD COLUMN offer_thread_id uuid");
    expect(migration).toContain("ADD COLUMN version_number bigint");
    expect(migration).toContain("ADD COLUMN submitted_by_organization_id uuid");
    expect(migration).toContain("ADD COLUMN parent_offer_id uuid");
    expect(migration).toContain("UNIQUE (offer_thread_id, version_number)");
    expect(migration).toContain("CREATE UNIQUE INDEX idx_offers_one_response_per_parent");
    expect(migration).toContain(
      "ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'superseded'",
    );
    expect(migration).not.toMatch(/DROP\s+TABLE\s+public\.(?:deals|offers)/iu);
  });

  it("keeps every submitted commercial field and lineage value immutable", () => {
    for (const field of [
      "amount",
      "currency",
      "valid_until",
      "notes",
      "offer_thread_id",
      "version_number",
      "submitted_by_organization_id",
      "parent_offer_id",
    ]) {
      expect(migration).toContain(`NEW.${field} IS DISTINCT FROM OLD.${field}`);
    }
    expect(fixtures).toContain("revision_history_immutability");
  });

  it("serializes counters and acceptance using the canonical lock order", () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.counter_deal_offer[\s\S]*FROM public\.deals deal[\s\S]*FOR UPDATE;[\s\S]*FROM public\.offer_threads thread[\s\S]*FOR UPDATE;[\s\S]*FROM public\.offers offer[\s\S]*FOR UPDATE;/u,
    );
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.accept_deal_offer[\s\S]*FROM public\.deals deal[\s\S]*FOR UPDATE;[\s\S]*FROM public\.offer_threads thread[\s\S]*FOR UPDATE;[\s\S]*FROM public\.offers offer[\s\S]*FOR UPDATE;/u,
    );
    expect(migration).toContain("Offer Thread changed concurrently");
    expect(migration).toContain("Offer Version changed concurrently");
    expect(fixtures).toContain("revision_concurrency_sequence");
    expect(fixtures).toContain("revision_counter_withdraw_race");
  });

  it("enforces alternating organization authority and buyer-only acceptance", () => {
    expect(migration).toContain("_parent.submitted_by_organization_id = _actor_organization_id");
    expect(migration).toContain("A party cannot counter its own Offer Version");
    expect(migration).toContain(
      "_offer.submitted_by_organization_id <> _deal.supplier_organization_id",
    );
    expect(migration).toContain("public.is_active_organization_member");
    expect(migration).toContain("public.user_organization_role");
    expect(fixtures).toContain("revision_authority_boundaries");
    expect(fixtures).toContain("revision_own_counter_denial");
    expect(fixtures).toContain("revision_atomic_acceptance");
  });

  it("exposes only narrow authenticated commands", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.submit_initial_deal_offer");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.counter_deal_offer");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.counter_deal_offer\(uuid, numeric, text, timestamptz, text\)\s+FROM PUBLIC, anon;/u,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.counter_deal_offer\(\s*uuid, numeric, text, timestamptz, text\s*\) TO authenticated;/u,
    );
    expect(migration).not.toMatch(
      /GRANT\s+(?:UPDATE|DELETE|ALL)[^;]*(?:offer_threads|offers)[^;]*authenticated/iu,
    );
    expect(migration).toContain('DROP POLICY IF EXISTS "Supplier members submit Offers"');
    expect(migration).toContain("AND offer_thread_id = id");
    expect(migration).toContain("AND version_number = 1");
    expect(migration).toContain("AND parent_offer_id IS NULL");
    expect(fixtures).toContain("revision_direct_append_denial");
    expect(fixtures).toContain("revision_dual_membership_denial");
  });

  it("reuses canonical audit evidence and leaves V2 data untouched", () => {
    expect(migration).toContain("INSERT INTO public.admin_audit_logs");
    expect(migration).toContain("offer.version_submitted");
    expect(migration).toContain("offer_thread.version_advanced");
    expect(fixtures).toContain("revision_audit_evidence");
    expect(fixtures).toContain("revision_unlimited_alternating_rounds");
    expect(migration).not.toMatch(
      /(?:INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE) public\.(?:rfqs|rfq_invitations|quotes|bookings|hotels|conversations|messages|notifications)\b/iu,
    );
  });
});
