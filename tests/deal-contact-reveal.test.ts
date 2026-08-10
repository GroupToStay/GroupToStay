import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  canRequestDealCounterpartyContact,
  getDealContactState,
  getSafeEmailHref,
  getSafePhoneHref,
  getSafeWhatsAppHref,
} from "../src/features/deals/deal-contact-model";
import { loadDealCounterpartyContact } from "../src/features/deals/deal-contact-service";
import type {
  DealRow,
  DealWorkspaceSnapshot,
  MembershipRow,
} from "../src/features/deals/deal-workspace-model";

const migration = readFileSync(
  resolve("supabase/migrations/20260811120000_identity_contact_reveal_policy.sql"),
  "utf8",
);
const fixtures = readFileSync(resolve("supabase/tests/deal-offer-fixtures.sql"), "utf8");

const deal: DealRow = {
  id: "10000000-0000-4000-8000-000000000001",
  buyer_organization_id: "20000000-0000-4000-8000-000000000001",
  supplier_organization_id: "30000000-0000-4000-8000-000000000001",
  source_rfq_id: null,
  source_invitation_id: null,
  source_hotel_id: null,
  status: "active",
  created_by: null,
  created_at: "2026-08-10T08:00:00.000Z",
  updated_at: "2026-08-10T08:00:00.000Z",
};

function snapshot(
  side: "buyer" | "supplier" | "inspector",
  role: MembershipRow["membership_role"] | null,
  status: DealRow["status"],
): DealWorkspaceSnapshot {
  return {
    actor: { side, role, isActive: side !== "inspector" },
    deal: { ...deal, status },
    offers: [],
    sourceHotel: null,
    sourceRfq: null,
  };
}

describe("Deal identity and contact reveal policy", () => {
  it("creates one immutable reveal record without copying contact values", () => {
    expect(migration).toContain("CREATE TABLE public.deal_contact_reveals");
    expect(migration).toContain("deal_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("accepted_offer_id uuid NOT NULL");
    expect(migration).toContain("policy_version text NOT NULL DEFAULT 'deal-contact-v1'");
    expect(migration).toContain("Deal contact reveal evidence is immutable");
    expect(migration).not.toMatch(
      /deal_contact_reveals[\s\S]{0,500}(?:email|phone|whatsapp|contact_name)\s+text/iu,
    );
  });

  it("creates reveal evidence atomically through buyer-only Offer acceptance", () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.accept_deal_offer[\s\S]*FROM public\.deals deal[\s\S]*FOR UPDATE;[\s\S]*UPDATE public\.offers SET status = 'accepted'[\s\S]*UPDATE public\.deals SET status = 'agreed'[\s\S]*INSERT INTO public\.deal_contact_reveals/iu,
    );
    expect(migration).toContain("ON CONFLICT (deal_id) DO NOTHING");
    expect(migration).toContain("CREATE CONSTRAINT TRIGGER deals_require_contact_reveal");
    expect(migration).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(fixtures).toContain("contact_reveal_atomic_idempotency");
    expect(fixtures).toContain("contact_reveal_failure_rollback");
    expect(fixtures).toContain("contact_reveal_closed_retention");
  });

  it("fails migration rather than guessing reveal state for existing agreed Deals", () => {
    expect(migration).toContain("WHERE status IN ('agreed', 'closed')");
    expect(migration).toContain("Existing agreed Deal data requires a separate owner-reviewed");
    expect(migration).not.toMatch(/INSERT INTO public\.deal_contact_reveals[^;]*SELECT/iu);
  });

  it("returns only the approved business contact projection", () => {
    expect(migration).toContain("public.get_deal_counterparty_contact(_deal_id uuid)");
    for (const field of [
      "business_name text",
      "contact_name text",
      "email text",
      "phone text",
      "whatsapp text",
      "address text",
      "organization_type text",
      "revealed_at timestamptz",
      "policy_version text",
    ]) {
      expect(migration).toContain(field);
    }
    expect(migration).not.toContain("FROM auth.users");
    expect(migration).not.toMatch(/get_deal_counterparty_contact\([^)]*_organization_id/iu);
    expect(fixtures).toContain("exact approved Supplier allowlist");
  });

  it("separates participant contact access from platform inspection", () => {
    expect(migration).toContain(
      'CREATE POLICY "Platform admins inspect Deal contact reveal evidence"',
    );
    expect(migration).toContain("public.is_enterprise_admin(auth.uid())");
    expect(migration).toContain("COALESCE(cardinality(_actor_organizations), 0) <> 1");
    expect(migration).toContain("membership.status = 'active'");
    expect(migration).toContain("organization.archived_at IS NULL");
    expect(fixtures).toContain("Platform Admin impersonated a Deal participant");
    expect(fixtures).toContain("Inactive Supplier membership retained contact access");
    expect(fixtures).toContain("Unrelated Agency retrieved Deal contact");
  });

  it("derives locked and revealed UI states without treating inspectors as participants", () => {
    expect(getDealContactState(snapshot("buyer", "agent", "active"))).toBe("locked");
    expect(getDealContactState(snapshot("buyer", "agent", "agreed"))).toBe("revealed");
    expect(getDealContactState(snapshot("supplier", "sales", "closed"))).toBe("revealed");
    expect(getDealContactState(snapshot("buyer", "viewer", "agreed"))).toBe("unavailable");
    expect(getDealContactState(snapshot("inspector", null, "agreed"))).toBe("unavailable");
    expect(getDealContactState(snapshot("buyer", "owner", "cancelled"))).toBe("unavailable");
    expect(canRequestDealCounterpartyContact(snapshot("supplier", "reservations", "agreed"))).toBe(
      true,
    );
  });

  it("constructs external contact actions only from normalized values", () => {
    expect(getSafeEmailHref(" sales@example.test ")).toBe("mailto:sales@example.test");
    expect(getSafeEmailHref("javascript:alert(1)")).toBeNull();
    expect(getSafePhoneHref("+966 55 123 4567")).toBe("tel:+966551234567");
    expect(getSafePhoneHref("call-me")).toBeNull();
    expect(getSafeWhatsAppHref("+966 55 123 4567")).toBe("https://wa.me/966551234567");
  });

  it("loads contact only through the narrow Deal-scoped RPC", async () => {
    const contact = {
      business_name: "Supplier Company",
      contact_name: null,
      email: "sales@example.test",
      phone: "+966551234567",
      whatsapp: null,
      address: "Business address",
      organization_type: "supplier",
      revealed_at: "2026-08-11T12:00:00.000Z",
      policy_version: "deal-contact-v1",
    };
    const invoke = vi.fn().mockResolvedValue({ data: [contact], error: null });

    await expect(loadDealCounterpartyContact(deal.id, invoke)).resolves.toEqual(contact);
    expect(invoke).toHaveBeenCalledWith({ _deal_id: deal.id });

    const service = readFileSync(resolve("src/features/deals/deal-contact-service.ts"), "utf8");
    expect(service).toContain('supabase.rpc("get_deal_counterparty_contact"');
    expect(service).not.toMatch(/\.from\(["']profiles["']\)/u);
  });

  it("keeps contact UI accessible, responsive and scoped to the Deal workspace", () => {
    const panel = readFileSync(resolve("src/features/deals/DealContactPanel.tsx"), "utf8");
    const chat = readFileSync(resolve("src/features/deals/DealChatPanel.tsx"), "utf8");
    const workspace = readFileSync(resolve("src/features/deals/NegotiationWorkspace.tsx"), "utf8");

    expect(panel).toContain('aria-live="polite"');
    expect(panel).toContain('aria-labelledby="deal-contact-title"');
    expect(panel).toContain('className="h-11 w-11"');
    expect(panel).toContain("navigator.clipboard.writeText");
    expect(panel).toContain("motion-reduce:animate-none");
    expect(panel).not.toContain("organization_id");
    expect(chat).toContain("workspace.chat.privacy.locked");
    expect(chat).toContain("workspace.chat.privacy.revealed");
    expect(chat).not.toContain("dangerouslySetInnerHTML");
    expect(workspace).toContain("<DealContactPanel snapshot={snapshot} />");
  });

  it("keeps English and Arabic privacy catalogs structurally identical", () => {
    const english = JSON.parse(readFileSync(resolve("src/locales/en/deals.json"), "utf8"));
    const arabic = JSON.parse(readFileSync(resolve("src/locales/ar/deals.json"), "utf8"));

    expect(Object.keys(arabic.workspace.contact).sort()).toEqual(
      Object.keys(english.workspace.contact).sort(),
    );
    expect(Object.keys(arabic.workspace.contact.error).sort()).toEqual(
      Object.keys(english.workspace.contact.error).sort(),
    );
    expect(Object.keys(arabic.workspace.chat.privacy).sort()).toEqual(
      Object.keys(english.workspace.chat.privacy).sort(),
    );
  });

  it("does not alter V2 business or contact authorization surfaces", () => {
    expect(migration).not.toMatch(
      /(?:ALTER TABLE|UPDATE|DELETE FROM|INSERT INTO) public\.(?:profiles|hotels|rfqs|rfq_invitations|quotes|bookings|conversations|chat_messages|messages|notifications)\b/iu,
    );
    expect(migration).not.toMatch(/(?:DROP|CREATE) POLICY[^;]*ON public\.profiles/iu);
    expect(fixtures).toContain("deal_chat_v2_messaging_regression");
  });
});
