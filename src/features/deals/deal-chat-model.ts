import type { Database } from "@/integrations/supabase/types";

import type {
  DealWorkspaceActor,
  DealWorkspaceSnapshot,
} from "@/features/deals/deal-workspace-model";

export type DealChatMessage = Pick<
  Database["public"]["Tables"]["chat_messages"]["Row"],
  "body" | "conversation_id" | "created_at" | "id" | "sender_organization_id"
>;

export type DealChatSnapshot = {
  conversationId: string | null;
  messages: DealChatMessage[];
};

const BUYER_CHAT_ROLES = new Set(["owner", "admin", "agent"]);
const SUPPLIER_CHAT_ROLES = new Set(["owner", "admin", "sales", "reservations"]);

export function canProvisionDealChat(snapshot: DealWorkspaceSnapshot) {
  return canSendDealChatMessage(snapshot);
}

export function canSendDealChatMessage(snapshot: DealWorkspaceSnapshot) {
  const { actor, deal } = snapshot;
  if (!actor.isActive || !actor.role || !["active", "agreed"].includes(deal.status)) return false;
  if (actor.side === "buyer") return BUYER_CHAT_ROLES.has(actor.role);
  if (actor.side === "supplier") return SUPPLIER_CHAT_ROLES.has(actor.role);
  return false;
}

export function getDealChatSenderOrganization(snapshot: DealWorkspaceSnapshot) {
  if (snapshot.actor.side === "buyer") return snapshot.deal.buyer_organization_id;
  if (snapshot.actor.side === "supplier") return snapshot.deal.supplier_organization_id;
  return null;
}

export function getDealChatSenderSide(
  snapshot: DealWorkspaceSnapshot,
  message: DealChatMessage,
): "buyer" | "supplier" | "unknown" {
  if (message.sender_organization_id === snapshot.deal.buyer_organization_id) return "buyer";
  if (message.sender_organization_id === snapshot.deal.supplier_organization_id) return "supplier";
  return "unknown";
}

export function isOwnDealChatMessage(
  actor: DealWorkspaceActor,
  side: ReturnType<typeof getDealChatSenderSide>,
) {
  return actor.side === side;
}
