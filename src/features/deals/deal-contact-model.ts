import type { Database } from "@/integrations/supabase/types";

import type { DealWorkspaceSnapshot } from "@/features/deals/deal-workspace-model";

type GeneratedDealCounterpartyContact =
  Database["public"]["Functions"]["get_deal_counterparty_contact"]["Returns"][number];

export type DealCounterpartyContact = Omit<
  GeneratedDealCounterpartyContact,
  "address" | "contact_name" | "email" | "phone" | "whatsapp"
> & {
  address: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
};

const BUYER_CONTACT_ROLES = new Set(["owner", "admin", "agent"]);
const SUPPLIER_CONTACT_ROLES = new Set(["owner", "admin", "sales", "reservations"]);

export function canRequestDealCounterpartyContact(snapshot: DealWorkspaceSnapshot) {
  const { actor, deal } = snapshot;
  if (!actor.isActive || !actor.role || !["agreed", "closed"].includes(deal.status)) {
    return false;
  }
  if (actor.side === "buyer") return BUYER_CONTACT_ROLES.has(actor.role);
  if (actor.side === "supplier") return SUPPLIER_CONTACT_ROLES.has(actor.role);
  return false;
}

export function getDealContactState(snapshot: DealWorkspaceSnapshot) {
  if (canRequestDealCounterpartyContact(snapshot)) return "revealed" as const;
  if (snapshot.deal.status === "active") return "locked" as const;
  return "unavailable" as const;
}

export function getSafeEmailHref(value: string | null) {
  const normalized = value?.trim() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized) ? `mailto:${normalized}` : null;
}

export function getSafePhoneHref(value: string | null) {
  const normalized = value?.replace(/[^\d+]/gu, "") ?? "";
  return /^\+?\d{6,15}$/u.test(normalized) ? `tel:${normalized}` : null;
}

export function getSafeWhatsAppHref(value: string | null) {
  const normalized = value?.replace(/\D/gu, "") ?? "";
  return /^\d{6,15}$/u.test(normalized) ? `https://wa.me/${normalized}` : null;
}
