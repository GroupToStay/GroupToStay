import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260809190000_deal_offer_foundation.sql"),
  "utf8",
);
const reconstruction = readFileSync(resolve("scripts/run-database-reconstruction.mjs"), "utf8");

describe("Deal and Offer foundation", () => {
  it("adds organization-owned commercial aggregates without rewriting V2", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.deals");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.offers");
    expect(migration).toContain("buyer_organization_id uuid NOT NULL");
    expect(migration).toContain("supplier_organization_id uuid NOT NULL");
    expect(migration).toContain("source_rfq_id uuid REFERENCES public.rfqs");
    expect(migration).toContain("source_invitation_id uuid UNIQUE");
    expect(migration).toContain("source_hotel_id uuid REFERENCES public.hotels");
    expect(migration).not.toMatch(
      /ALTER TABLE public\.(rfqs|rfq_invitations|quotes|bookings|hotels)\b/iu,
    );
    expect(migration).not.toMatch(
      /(?:INSERT INTO|UPDATE|DELETE FROM) public\.(rfqs|rfq_invitations|quotes|bookings|hotels)\b/iu,
    );
  });

  it("binds every Offer to the Deal supplier and keeps terms immutable", () => {
    expect(migration).toContain("CONSTRAINT offers_deal_supplier_fkey");
    expect(migration).toContain("REFERENCES public.deals(id, supplier_organization_id)");
    expect(migration).toContain("offers_amount_positive_check");
    expect(migration).toContain("offers_currency_iso_check");
    expect(migration).toContain("Submitted Offer commercial terms");
  });

  it("keeps ordinary client grants narrow", () => {
    expect(migration).toContain("GRANT SELECT, INSERT ON public.deals TO authenticated");
    expect(migration).toContain("GRANT SELECT, INSERT ON public.offers TO authenticated");
    expect(migration).not.toMatch(
      /GRANT\s+(?:UPDATE|DELETE|ALL)[^;]*(?:deals|offers)[^;]*authenticated/iu,
    );
    expect(migration).toContain("Agency members create sourced Deals");
    expect(migration).toContain("Supplier members submit Offers");
    expect(migration).toContain(
      "public.user_organization_role(_buyer_organization_id) IN ('owner', 'admin', 'agent')",
    );
    expect(migration).toContain("IN ('owner', 'admin', 'sales', 'reservations')");
  });

  it("makes organization isolation and anonymous denial reconstruction-blocking", () => {
    expect(migration).toContain("ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("public.is_active_organization_member");
    expect(reconstruction).toContain('"supabase/tests/deal-offer-fixtures.sql"');
    expect(reconstruction).toContain("dealOfferFixtures");
  });
});
