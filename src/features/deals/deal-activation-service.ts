import { supabase } from "@/integrations/supabase/client";
import {
  resolveDealWorkspaceActor,
  selectLatestOfferVersion,
  type DealSourceHotel,
  type DealSourceRfq,
  type DealWorkspaceActor,
  type DealRow,
  type MembershipRow,
  type OfferRow,
} from "@/features/deals/deal-workspace-model";

export type EnsureDealResult = {
  dealId: string;
  status: DealRow["status"];
  created: boolean;
  idempotent: boolean;
};

type EnsureDealInvoker = (args: {
  _invitation_id: string;
}) => PromiseLike<{ data: unknown; error: unknown }>;

const invokeEnsureDeal: EnsureDealInvoker = (args) =>
  supabase.rpc("ensure_deal_for_invitation" as never, args as never);

export async function ensureDealForInvitation(
  invitationId: string,
  invoke: EnsureDealInvoker = invokeEnsureDeal,
): Promise<EnsureDealResult> {
  const result = await invoke({ _invitation_id: invitationId });
  if (result.error) throw result.error;

  const payload = result.data;
  if (!payload || typeof payload !== "object" || !("deal_id" in payload)) {
    throw new Error("Deal activation returned an invalid response");
  }

  const value = payload as Record<string, unknown>;
  if (typeof value.deal_id !== "string" || typeof value.status !== "string") {
    throw new Error("Deal activation returned an invalid response");
  }

  return {
    dealId: value.deal_id,
    status: value.status as DealRow["status"],
    created: value.created === true,
    idempotent: value.idempotent === true,
  };
}

export type NegotiationListItem = {
  actor: DealWorkspaceActor;
  deal: DealRow;
  latestOffer: OfferRow | null;
  sourceHotel: DealSourceHotel | null;
  sourceRfq: DealSourceRfq | null;
};

export const negotiationListQueryKey = (userId?: string | null) => [
  "deal-negotiations",
  userId ?? "anonymous",
];

export const negotiationListQueryRoot = ["deal-negotiations"];

export async function loadMyNegotiations(userId: string): Promise<NegotiationListItem[]> {
  const dealsResult = await supabase
    .from("deals")
    .select("*")
    .order("updated_at", { ascending: false });
  if (dealsResult.error) throw dealsResult.error;

  const deals = dealsResult.data ?? [];
  if (deals.length === 0) return [];

  const dealIds = deals.map((deal) => deal.id);
  const organizationIds = [
    ...new Set(
      deals.flatMap((deal) => [deal.buyer_organization_id, deal.supplier_organization_id]),
    ),
  ];
  const rfqIds = deals.flatMap((deal) => (deal.source_rfq_id ? [deal.source_rfq_id] : []));
  const hotelIds = deals.flatMap((deal) => (deal.source_hotel_id ? [deal.source_hotel_id] : []));

  const [offersResult, membershipsResult, rfqsResult, hotelsResult] = await Promise.all([
    supabase
      .from("offers")
      .select("*")
      .in("deal_id", dealIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("organization_memberships")
      .select("organization_id, membership_role, status")
      .eq("user_id", userId)
      .in("organization_id", organizationIds),
    rfqIds.length > 0
      ? supabase
          .from("rfqs")
          .select(
            "id, title, destination_city, destination_country, check_in, check_out, guests_count, rooms_needed, currency",
          )
          .in("id", rfqIds)
      : Promise.resolve({ data: [], error: null }),
    hotelIds.length > 0
      ? supabase.from("hotels").select("id, name, city, country, star_rating").in("id", hotelIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (offersResult.error) throw offersResult.error;
  if (membershipsResult.error) throw membershipsResult.error;
  if (rfqsResult.error) throw rfqsResult.error;
  if (hotelsResult.error) throw hotelsResult.error;

  const offers = offersResult.data ?? [];
  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const rfqs = new Map((rfqsResult.data ?? []).map((rfq) => [rfq.id, rfq]));
  const hotels = new Map((hotelsResult.data ?? []).map((hotel) => [hotel.id, hotel]));

  return deals.map((deal) => {
    const dealOffers = offers.filter((offer) => offer.deal_id === deal.id);
    return {
      actor: resolveDealWorkspaceActor(deal, memberships),
      deal,
      latestOffer: selectLatestOfferVersion(dealOffers),
      sourceRfq: deal.source_rfq_id
        ? ((rfqs.get(deal.source_rfq_id) as DealSourceRfq | undefined) ?? null)
        : null,
      sourceHotel: deal.source_hotel_id
        ? ((hotels.get(deal.source_hotel_id) as DealSourceHotel | undefined) ?? null)
        : null,
    };
  });
}
