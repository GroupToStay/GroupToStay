import type { Database } from "@/integrations/supabase/types";

export type DealRow = Database["public"]["Tables"]["deals"]["Row"];
export type OfferRow = Database["public"]["Tables"]["offers"]["Row"];
export type MembershipRow = Pick<
  Database["public"]["Tables"]["organization_memberships"]["Row"],
  "membership_role" | "organization_id" | "status"
>;

export type DealSourceRfq = Pick<
  Database["public"]["Tables"]["rfqs"]["Row"],
  | "check_in"
  | "check_out"
  | "destination_city"
  | "destination_country"
  | "guests_count"
  | "rooms_needed"
  | "currency"
  | "title"
>;

export type DealSourceHotel = Pick<
  Database["public"]["Tables"]["hotels"]["Row"],
  "city" | "country" | "name" | "star_rating"
>;

export type DealWorkspaceActor = {
  side: "buyer" | "supplier" | "inspector";
  role: MembershipRow["membership_role"] | null;
  isActive: boolean;
};

export type DealWorkspaceSnapshot = {
  actor: DealWorkspaceActor;
  deal: DealRow;
  offers: OfferRow[];
  sourceHotel: DealSourceHotel | null;
  sourceRfq: DealSourceRfq | null;
};

export type DealWorkspaceAction = "accept" | "reject" | "withdraw" | "expire" | "cancel" | "close";
export type OfferWorkspaceAction = DealWorkspaceAction | "counter";
export type OfferSubmittingSide = "buyer" | "supplier";
export type OfferThreadHistory = {
  id: string;
  offers: OfferRow[];
};

export type NegotiationAttention =
  "your_action" | "waiting_counterparty" | "agreed" | "closed" | "cancelled";

export type DealWorkspaceErrorKind =
  "backend_unavailable" | "network" | "permission" | "stale" | "state_changed" | "unknown";

const BUYER_COMMAND_ROLES = new Set<MembershipRow["membership_role"]>(["owner", "admin", "agent"]);
const SUPPLIER_COMMAND_ROLES = new Set<MembershipRow["membership_role"]>([
  "owner",
  "admin",
  "sales",
  "reservations",
]);

export function isDealId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export function resolveDealWorkspaceActor(
  deal: DealRow,
  memberships: MembershipRow[],
): DealWorkspaceActor {
  const buyer = memberships.find(
    (membership) =>
      membership.organization_id === deal.buyer_organization_id && membership.status === "active",
  );
  const supplier = memberships.find(
    (membership) =>
      membership.organization_id === deal.supplier_organization_id &&
      membership.status === "active",
  );

  // A dual-sided membership is an invalid commercial authority context. Keep it read-only.
  if (buyer && supplier) return { side: "inspector", role: null, isActive: false };
  if (buyer) return { side: "buyer", role: buyer.membership_role, isActive: true };
  if (supplier) return { side: "supplier", role: supplier.membership_role, isActive: true };
  return { side: "inspector", role: null, isActive: false };
}

export function canUseBuyerCommands(actor: DealWorkspaceActor) {
  return (
    actor.side === "buyer" &&
    actor.isActive &&
    actor.role !== null &&
    BUYER_COMMAND_ROLES.has(actor.role)
  );
}

export function canUseSupplierCommands(actor: DealWorkspaceActor) {
  return (
    actor.side === "supplier" &&
    actor.isActive &&
    actor.role !== null &&
    SUPPLIER_COMMAND_ROLES.has(actor.role)
  );
}

export function canSubmitInitialOffer(snapshot: DealWorkspaceSnapshot) {
  return (
    snapshot.deal.status === "active" &&
    snapshot.offers.length === 0 &&
    canUseSupplierCommands(snapshot.actor)
  );
}

export function getDealActions(deal: DealRow, actor: DealWorkspaceActor): DealWorkspaceAction[] {
  if (!canUseBuyerCommands(actor)) return [];
  if (deal.status === "active") return ["cancel"];
  if (deal.status === "agreed") return ["close"];
  return [];
}

export function isOfferPastValidity(offer: OfferRow, now = new Date()) {
  if (!offer.valid_until) return false;
  const validUntil = new Date(offer.valid_until).getTime();
  return Number.isFinite(validUntil) && validUntil <= now.getTime();
}

export function getOfferSubmittingSide(deal: DealRow, offer: OfferRow): OfferSubmittingSide | null {
  if (offer.submitted_by_organization_id === deal.buyer_organization_id) return "buyer";
  if (offer.submitted_by_organization_id === deal.supplier_organization_id) return "supplier";
  return null;
}

export function isLatestOfferVersion(offer: OfferRow, offers: OfferRow[]) {
  return !offers.some(
    (candidate) =>
      candidate.offer_thread_id === offer.offer_thread_id &&
      candidate.version_number > offer.version_number,
  );
}

export function getOfferActions(
  deal: DealRow,
  offer: OfferRow,
  actor: DealWorkspaceActor,
  now = new Date(),
  offers: OfferRow[] = [offer],
): OfferWorkspaceAction[] {
  if (
    deal.status !== "active" ||
    offer.status !== "submitted" ||
    !isLatestOfferVersion(offer, offers)
  ) {
    return [];
  }

  const expired = isOfferPastValidity(offer, now);
  const submittedBy = getOfferSubmittingSide(deal, offer);
  if (canUseBuyerCommands(actor) && submittedBy === "supplier") {
    return [
      ...(!expired ? (["accept"] as const) : []),
      "reject",
      ...(!expired ? (["counter"] as const) : []),
      ...(expired ? (["expire"] as const) : []),
    ];
  }
  if (canUseSupplierCommands(actor) && submittedBy === "buyer") {
    return [
      "reject",
      ...(!expired ? (["counter"] as const) : []),
      ...(expired ? (["expire"] as const) : []),
    ];
  }
  if (canUseSupplierCommands(actor) && submittedBy === "supplier") {
    return ["withdraw", ...(expired ? (["expire"] as const) : [])];
  }
  return [];
}

export function selectCommercialOffer(offers: OfferRow[]) {
  const accepted = offers.find((offer) => offer.status === "accepted");
  if (accepted) return accepted;

  return (
    [...offers]
      .filter((offer) => offer.status === "submitted")
      .sort((left, right) => right.created_at.localeCompare(left.created_at))[0] ??
    [...offers].sort((left, right) => right.created_at.localeCompare(left.created_at))[0] ??
    null
  );
}

export function selectLatestOfferVersion(offers: OfferRow[]) {
  return (
    [...offers].sort((left, right) => {
      const createdOrder = right.created_at.localeCompare(left.created_at);
      return createdOrder !== 0 ? createdOrder : right.version_number - left.version_number;
    })[0] ?? null
  );
}

export function getNegotiationAttention(
  deal: DealRow,
  latestOffer: OfferRow | null,
  actor: DealWorkspaceActor,
): NegotiationAttention {
  if (deal.status === "agreed") return "agreed";
  if (deal.status === "closed") return "closed";
  if (deal.status === "cancelled") return "cancelled";

  if (!latestOffer) {
    return actor.side === "supplier" ? "your_action" : "waiting_counterparty";
  }

  if (latestOffer.status === "accepted") return "agreed";
  const submittingSide = getOfferSubmittingSide(deal, latestOffer);
  if (submittingSide === null || actor.side === "inspector") return "waiting_counterparty";
  return submittingSide === actor.side ? "waiting_counterparty" : "your_action";
}

export function groupOfferHistory(offers: OfferRow[]): OfferThreadHistory[] {
  const grouped = new Map<string, OfferRow[]>();
  for (const offer of offers) {
    const threadOffers = grouped.get(offer.offer_thread_id) ?? [];
    threadOffers.push(offer);
    grouped.set(offer.offer_thread_id, threadOffers);
  }

  return [...grouped.entries()]
    .map(([id, threadOffers]) => ({
      id,
      offers: threadOffers.sort((left, right) => left.version_number - right.version_number),
    }))
    .sort((left, right) => {
      const leftCreated = left.offers[0]?.created_at ?? "";
      const rightCreated = right.offers[0]?.created_at ?? "";
      return leftCreated.localeCompare(rightCreated);
    });
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "";
  return error.message.toLowerCase();
}

export function classifyDealWorkspaceError(error: unknown): DealWorkspaceErrorKind {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  if (code === "PGRST205" || code === "42P01") return "backend_unavailable";
  if (code === "42501" || code === "PGRST301") return "permission";
  if (code === "40001") return "stale";
  if (code === "55000") return "state_changed";
  if (
    error instanceof TypeError ||
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("connection")
  ) {
    return "network";
  }
  return "unknown";
}
