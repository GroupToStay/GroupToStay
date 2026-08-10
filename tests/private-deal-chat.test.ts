import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  canProvisionDealChat,
  canSendDealChatMessage,
  getDealChatSenderOrganization,
  getDealChatSenderSide,
  isOwnDealChatMessage,
  type DealChatMessage,
} from "../src/features/deals/deal-chat-model";
import { sendDealMessage } from "../src/features/deals/deal-chat-service";
import type {
  DealRow,
  DealWorkspaceSnapshot,
  MembershipRow,
} from "../src/features/deals/deal-workspace-model";

const migration = readFileSync(
  resolve("supabase/migrations/20260810210000_private_deal_chat_foundation.sql"),
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
  status: DealRow["status"] = "active",
): DealWorkspaceSnapshot {
  return {
    actor: { side, role, isActive: side !== "inspector" },
    deal: { ...deal, status },
    offers: [],
    sourceHotel: null,
    sourceRfq: null,
  };
}

describe("Private Deal Chat foundation", () => {
  it("extends the canonical V2 messaging tables instead of duplicating them", () => {
    expect(migration).toContain("ALTER TABLE public.conversations");
    expect(migration).toContain("ADD COLUMN deal_id uuid");
    expect(migration).toContain("ALTER TABLE public.chat_messages");
    expect(migration).toContain("ADD COLUMN sender_organization_id uuid");
    expect(migration).not.toMatch(
      /CREATE TABLE(?: IF NOT EXISTS)? public\.(?:deal_conversations|deal_messages)/iu,
    );
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM public\./iu);
  });

  it("keeps one conversation per Deal and preserves an explicit legacy context branch", () => {
    expect(migration).toContain("CONSTRAINT conversations_deal_id_key UNIQUE (deal_id)");
    expect(migration).toContain("CONSTRAINT conversations_context_check CHECK");
    expect(migration).toContain("deal_id IS NULL");
    expect(migration).toContain("rfq_id IS NOT NULL");
    expect(migration).toContain("deal_id IS NOT NULL");
    expect(migration).toContain("rfq_id IS NULL");
    expect(migration).toContain("ON CONFLICT (deal_id) DO NOTHING");
    expect(fixtures).toContain("Deal conversation provisioning was not idempotent");
  });

  it("enforces organization isolation and server-only Deal message writes", () => {
    expect(migration).toContain(
      'CREATE POLICY "Deal participants and platform admins view Deal conversations"',
    );
    expect(migration).toContain(
      'CREATE POLICY "Deal participants and platform admins view Deal chat messages"',
    );
    expect(migration).toContain("public.is_deal_conversation_participant");
    expect(migration).not.toContain(
      "CREATE OR REPLACE FUNCTION public.is_conversation_participant",
    );
    expect(migration).toContain("membership.status = 'active'");
    expect(migration).toContain("organization.archived_at IS NULL");
    expect(migration).toContain("sender_organization_id IS NULL");
    expect(migration).toContain("public.is_enterprise_admin(auth.uid())");
    expect(fixtures).toContain("deal_chat_cross_organization_denial");
    expect(fixtures).toContain("deal_chat_inactive_member_denial");
    expect(fixtures).toContain("deal_chat_admin_inspection_only");
    expect(fixtures).toContain("deal_chat_anonymous_denial");
  });

  it("provides narrow commands with safe grants and deterministic validation", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.ensure_deal_conversation");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.send_deal_message");
    expect(migration).toMatch(/SECURITY DEFINER\s+SET search_path = ''/u);
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.ensure_deal_conversation(uuid)");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.send_deal_message(uuid, uuid, text)",
    );
    expect(migration).toContain("FROM PUBLIC, anon");
    expect(migration).toContain("Message must contain 1 to 4000 characters");
    expect(migration).toContain("_deal.status NOT IN ('active', 'agreed')");
    expect(fixtures).toContain("deal_chat_terminal_read_only");
  });

  it("keeps Deal messages immutable, plain text, ordered and attachment-free", () => {
    expect(migration).toContain("Deal messages are immutable");
    expect(migration).toContain("attachments = '[]'::jsonb");
    expect(migration).toContain("idx_chat_messages_conversation_order");
    expect(fixtures).toContain('<script>alert("safe text")</script>');
    expect(fixtures).toContain("deal_chat_immutability");
  });

  it("derives send authority from active organization role and Deal state", () => {
    const buyer = snapshot("buyer", "agent");
    const supplier = snapshot("supplier", "sales");
    const viewer = snapshot("buyer", "viewer");
    const inspector = snapshot("inspector", null);

    expect(canProvisionDealChat(buyer)).toBe(true);
    expect(canSendDealChatMessage(buyer)).toBe(true);
    expect(canSendDealChatMessage(supplier)).toBe(true);
    expect(canSendDealChatMessage(viewer)).toBe(false);
    expect(canSendDealChatMessage(inspector)).toBe(false);
    expect(canSendDealChatMessage(snapshot("buyer", "owner", "agreed"))).toBe(true);
    expect(canSendDealChatMessage(snapshot("buyer", "owner", "closed"))).toBe(false);
    expect(canSendDealChatMessage(snapshot("supplier", "owner", "cancelled"))).toBe(false);
    expect(getDealChatSenderOrganization(buyer)).toBe(deal.buyer_organization_id);
    expect(getDealChatSenderOrganization(supplier)).toBe(deal.supplier_organization_id);
  });

  it("derives safe participant labels without loading raw sender identities", () => {
    const message = {
      id: crypto.randomUUID(),
      conversation_id: crypto.randomUUID(),
      sender_organization_id: deal.supplier_organization_id,
      body: "Clarification",
      created_at: "2026-08-10T10:00:00.000Z",
    } satisfies DealChatMessage;
    const buyer = snapshot("buyer", "owner");

    expect(getDealChatSenderSide(buyer, message)).toBe("supplier");
    expect(isOwnDealChatMessage(buyer.actor, "supplier")).toBe(false);
    expect(isOwnDealChatMessage(snapshot("supplier", "sales").actor, "supplier")).toBe(true);
  });

  it("sends only through the canonical RPC", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { id: crypto.randomUUID() },
      error: null,
    });
    await sendDealMessage("conversation-id", "organization-id", "Hello", invoke);
    expect(invoke).toHaveBeenCalledWith({
      _conversation_id: "conversation-id",
      _sender_organization_id: "organization-id",
      _body: "Hello",
    });

    const service = readFileSync(resolve("src/features/deals/deal-chat-service.ts"), "utf8");
    expect(service).toContain('supabase.rpc("send_deal_message"');
    expect(service).not.toMatch(/\.from\(["']chat_messages["']\)\s*\.insert/u);
  });

  it("keeps realtime scoped and the UI accessible, responsive, and safe-text only", () => {
    const component = readFileSync(resolve("src/features/deals/DealChatPanel.tsx"), "utf8");
    const workspace = readFileSync(resolve("src/features/deals/NegotiationWorkspace.tsx"), "utf8");
    expect(component).toContain("filter: `conversation_id=eq.${conversationId}`");
    expect(component).toContain("supabase.removeChannel(channel)");
    expect(component).toContain('role="log"');
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain('dir="auto"');
    expect(component).toContain('type="submit"');
    expect(component).toContain("event.preventDefault()");
    expect(component).toContain("min-h-11");
    expect(component).toContain("motion-reduce:animate-none");
    expect(component).not.toContain("dangerouslySetInnerHTML");
    expect(component).not.toContain("sender_id");
    expect(workspace).toContain('<Tabs defaultValue="offers"');
    expect(workspace).toContain('<TabsTrigger value="chat"');
  });

  it("keeps English and Arabic Deal Chat catalogs structurally identical", () => {
    const english = JSON.parse(readFileSync(resolve("src/locales/en/deals.json"), "utf8"));
    const arabic = JSON.parse(readFileSync(resolve("src/locales/ar/deals.json"), "utf8"));
    expect(Object.keys(arabic.workspace.chat).sort()).toEqual(
      Object.keys(english.workspace.chat).sort(),
    );
    expect(Object.keys(arabic.workspace.chat.errors).sort()).toEqual(
      Object.keys(english.workspace.chat.errors).sort(),
    );
  });
});
