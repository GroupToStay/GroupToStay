import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { ensureDealForInvitation } from "../src/features/deals/deal-activation-service";
import {
  canSubmitInitialOffer,
  getNegotiationAttention,
  type DealRow,
  type DealWorkspaceSnapshot,
  type OfferRow,
} from "../src/features/deals/deal-workspace-model";
import { executeInitialOffer } from "../src/features/deals/deal-workspace-service";

const migration = readFileSync(
  resolve("supabase/migrations/20260811170000_v2_v3_deal_activation.sql"),
  "utf8",
);
const fixtures = readFileSync(resolve("supabase/tests/deal-offer-fixtures.sql"), "utf8");

const deal: DealRow = {
  id: "10000000-0000-4000-8000-000000000001",
  buyer_organization_id: "20000000-0000-4000-8000-000000000001",
  supplier_organization_id: "30000000-0000-4000-8000-000000000001",
  source_rfq_id: "40000000-0000-4000-8000-000000000001",
  source_invitation_id: "50000000-0000-4000-8000-000000000001",
  source_hotel_id: "60000000-0000-4000-8000-000000000001",
  status: "active",
  created_by: null,
  created_at: "2026-08-10T08:00:00.000Z",
  updated_at: "2026-08-10T08:00:00.000Z",
};

const supplierOffer: OfferRow = {
  id: "70000000-0000-4000-8000-000000000001",
  deal_id: deal.id,
  supplier_organization_id: deal.supplier_organization_id,
  offer_thread_id: "80000000-0000-4000-8000-000000000001",
  version_number: 1,
  submitted_by_organization_id: deal.supplier_organization_id,
  parent_offer_id: null,
  amount: 150000,
  currency: "SAR",
  valid_until: null,
  notes: null,
  status: "submitted",
  created_by: null,
  created_at: "2026-08-10T09:00:00.000Z",
  updated_at: "2026-08-10T09:00:00.000Z",
};

function snapshot(side: "buyer" | "supplier", offers: OfferRow[] = []): DealWorkspaceSnapshot {
  return {
    actor: {
      side,
      role: side === "buyer" ? "agent" : "sales",
      isActive: true,
    },
    deal,
    offers,
    sourceHotel: null,
    sourceRfq: null,
  };
}

describe("V2 to V3 Deal activation", () => {
  it("provisions one deterministic Deal through a narrow idempotent command", () => {
    expect(migration).toContain("public.sourced_deal_id(_invitation_id uuid)");
    expect(migration).toContain("public.ensure_deal_for_invitation(_invitation_id uuid)");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("ON CONFLICT (source_invitation_id) DO NOTHING");
    expect(migration).toContain("public.is_active_organization_member");
    expect(migration).toContain("public.user_organization_role");
    expect(migration).toContain("_buyer_actor = _supplier_actor");
    expect(migration).toContain("deal.activated_from_invitation");
  });

  it("does not rewrite or backfill V2 commercial records", () => {
    expect(migration).not.toMatch(
      /(?:INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE) public\.(?:rfqs|rfq_invitations|quotes|bookings|hotels|conversations|messages|chat_messages|notifications)\b/iu,
    );
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN|POLICY|FUNCTION)/iu);
  });

  it("keeps platform admins and unrelated organizations out of activation", () => {
    expect(migration).not.toContain("public.is_enterprise_admin");
    expect(fixtures).toContain("Unrelated Supplier activated another invitation");
    expect(fixtures).toContain(
      "Platform Admin impersonated a marketplace participant during Deal activation",
    );
  });

  it("calls Deal activation without accepting caller-supplied organization ownership", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { deal_id: deal.id, status: "active", created: true, idempotent: false },
      error: null,
    });

    await expect(ensureDealForInvitation(deal.source_invitation_id!, invoke)).resolves.toEqual({
      dealId: deal.id,
      status: "active",
      created: true,
      idempotent: false,
    });
    expect(invoke).toHaveBeenCalledWith({ _invitation_id: deal.source_invitation_id });
  });

  it("submits the initial Supplier offer only through the canonical idempotent RPC", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { offer_id: supplierOffer.id, version_number: 1 },
      error: null,
    });
    const input = {
      dealId: deal.id,
      amount: 150000,
      currency: "SAR",
      validUntil: null,
      notes: "Initial terms",
      requestId: "90000000-0000-4000-8000-000000000001",
    };

    await expect(executeInitialOffer(input, invoke)).resolves.toMatchObject({ version_number: 1 });
    expect(invoke).toHaveBeenCalledWith({
      _deal_id: deal.id,
      _amount: 150000,
      _currency: "SAR",
      _valid_until: null,
      _notes: "Initial terms",
      _request_id: input.requestId,
    });
    expect(canSubmitInitialOffer(snapshot("supplier"))).toBe(true);
    expect(canSubmitInitialOffer(snapshot("buyer"))).toBe(false);
    expect(canSubmitInitialOffer(snapshot("supplier", [supplierOffer]))).toBe(false);
  });

  it("derives list attention without duplicating lifecycle authorization", () => {
    expect(getNegotiationAttention(deal, null, snapshot("supplier").actor)).toBe("your_action");
    expect(getNegotiationAttention(deal, null, snapshot("buyer").actor)).toBe(
      "waiting_counterparty",
    );
    expect(getNegotiationAttention(deal, supplierOffer, snapshot("buyer").actor)).toBe(
      "your_action",
    );
    expect(getNegotiationAttention(deal, supplierOffer, snapshot("supplier").actor)).toBe(
      "waiting_counterparty",
    );
    expect(
      getNegotiationAttention(
        { ...deal, status: "agreed" },
        supplierOffer,
        snapshot("buyer").actor,
      ),
    ).toBe("agreed");
  });

  it("certifies the authenticated RFQ to reveal journey in the isolated database", () => {
    expect(fixtures).toContain("deal_activation_idempotency_authority");
    expect(fixtures).toContain("deal_activation_authenticated_end_to_end");
    expect(fixtures).toContain("Activation journey Agency counteroffer");
    expect(fixtures).toContain("Activation journey Supplier counteroffer");
    expect(fixtures).toContain("Agency clarification in the activated Deal");
    expect(fixtures).toContain("Supplier clarification in the activated Deal");
    expect(fixtures).toContain("public.get_deal_counterparty_contact");
  });

  it("keeps activation lazy, localized, and discoverable without raw identifiers", () => {
    const flag = readFileSync(resolve("src/features/deals/deal-activation-config.ts"), "utf8");
    const list = readFileSync(
      resolve("src/routes/_authenticated/dashboard.negotiations.tsx"),
      "utf8",
    );
    const invitations = readFileSync(
      resolve("src/routes/_authenticated/dashboard.invitations.tsx"),
      "utf8",
    );
    const agencyDetail = readFileSync(
      resolve("src/routes/_authenticated/dashboard.rfqs.$id.tsx"),
      "utf8",
    );
    const workspace = readFileSync(resolve("src/features/deals/NegotiationWorkspace.tsx"), "utf8");

    expect(flag).toContain('VITE_V3_DEAL_ACTIVATION_ENABLED ?? "false"');
    expect(list).toContain('createFileRoute("/_authenticated/dashboard/negotiations")');
    expect(list).not.toContain("source_invitation_id}");
    expect(invitations).toContain("<DealActivationButton");
    expect(agencyDetail).toContain("replacedByNegotiation");
    expect(agencyDetail).toContain("directNegotiationTitle");
    expect(workspace).toContain("<InitialOfferDialog");
  });

  it("keeps English and Arabic activation catalogs structurally identical", () => {
    const english = JSON.parse(readFileSync(resolve("src/locales/en/deals.json"), "utf8"));
    const arabic = JSON.parse(readFileSync(resolve("src/locales/ar/deals.json"), "utf8"));
    expect(Object.keys(arabic.activation).sort()).toEqual(Object.keys(english.activation).sort());
    expect(Object.keys(arabic.activation.actions).sort()).toEqual(
      Object.keys(english.activation.actions).sort(),
    );
    expect(Object.keys(arabic.activation.legacy).sort()).toEqual(
      Object.keys(english.activation.legacy).sort(),
    );
    expect(Object.keys(arabic.workspace.initialOffer).sort()).toEqual(
      Object.keys(english.workspace.initialOffer).sort(),
    );
  });
});
