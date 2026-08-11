import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  resolveDealWorkspaceActor,
  type DealSourceHotel,
  type DealSourceRfq,
  type DealWorkspaceAction,
  type DealWorkspaceSnapshot,
  type MembershipRow,
} from "@/features/deals/deal-workspace-model";

export const dealWorkspaceQueryKey = (dealId: string, userId?: string | null) => [
  "deal-workspace",
  dealId,
  userId ?? "anonymous",
];

export async function loadDealWorkspace(
  dealId: string,
  userId: string,
): Promise<DealWorkspaceSnapshot | null> {
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .maybeSingle();

  if (dealError) throw dealError;
  if (!deal) return null;

  const [offersResult, membershipsResult, rfqResult, hotelResult] = await Promise.all([
    supabase
      .from("offers")
      .select("*")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: true })
      .order("version_number", { ascending: true }),
    supabase
      .from("organization_memberships")
      .select("organization_id, membership_role, status")
      .eq("user_id", userId)
      .in("organization_id", [deal.buyer_organization_id, deal.supplier_organization_id]),
    deal.source_rfq_id
      ? supabase
          .from("rfqs")
          .select(
            "title, destination_city, destination_country, check_in, check_out, guests_count, rooms_needed, currency",
          )
          .eq("id", deal.source_rfq_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    deal.source_hotel_id
      ? supabase
          .from("hotels")
          .select("name, city, country, star_rating")
          .eq("id", deal.source_hotel_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (offersResult.error) throw offersResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  return {
    actor: resolveDealWorkspaceActor(deal, memberships),
    deal,
    offers: offersResult.data ?? [],
    // Source context is enhancement-only. Its own RLS decides whether it is visible.
    sourceRfq: rfqResult.error ? null : (rfqResult.data as DealSourceRfq | null),
    sourceHotel: hotelResult.error ? null : (hotelResult.data as DealSourceHotel | null),
  };
}

type DealCommandResult = Database["public"]["Functions"]["accept_deal_offer"]["Returns"];

export const dealWorkspaceCommands = {
  accept: ["accept_deal_offer", "_offer_id"],
  reject: ["reject_deal_offer", "_offer_id"],
  withdraw: ["withdraw_deal_offer", "_offer_id"],
  expire: ["expire_deal_offer", "_offer_id"],
  cancel: ["cancel_deal", "_deal_id"],
  close: ["close_deal", "_deal_id"],
} as const satisfies Record<DealWorkspaceAction, readonly [string, string]>;

type DealCommandRpc = (typeof dealWorkspaceCommands)[DealWorkspaceAction][0];
type DealCommandResponse = {
  data: DealCommandResult | null;
  error: unknown;
};
type DealCommandInvoker = (
  rpc: DealCommandRpc,
  args: Record<string, string>,
) => PromiseLike<DealCommandResponse>;

const invokeDealCommand: DealCommandInvoker = (rpc, args) => supabase.rpc(rpc, args as never);

export async function executeDealWorkspaceAction(
  action: DealWorkspaceAction,
  targetId: string,
  invoke: DealCommandInvoker = invokeDealCommand,
): Promise<DealCommandResult> {
  const [rpc, argument] = dealWorkspaceCommands[action];
  const result = await invoke(rpc, { [argument]: targetId });

  if (result.error) throw result.error;
  return result.data!;
}

export type CounterOfferInput = {
  parentOfferId: string;
  amount: number;
  currency: string;
  validUntil: string | null;
  notes: string | null;
};

export type InitialOfferInput = {
  dealId: string;
  amount: number;
  currency: string;
  validUntil: string | null;
  notes: string | null;
  requestId: string;
};

type InitialOfferResult = Database["public"]["Functions"]["submit_initial_deal_offer"]["Returns"];
type InitialOfferArgs = {
  _deal_id: string;
  _amount: number;
  _currency: string;
  _valid_until: string | null;
  _notes: string | null;
  _request_id: string;
};
type InitialOfferInvoker = (
  args: InitialOfferArgs,
) => PromiseLike<{ data: InitialOfferResult | null; error: unknown }>;

const invokeInitialOffer: InitialOfferInvoker = (args) =>
  supabase.rpc("submit_initial_deal_offer", args as never);

export async function executeInitialOffer(
  input: InitialOfferInput,
  invoke: InitialOfferInvoker = invokeInitialOffer,
): Promise<InitialOfferResult> {
  const result = await invoke({
    _deal_id: input.dealId,
    _amount: input.amount,
    _currency: input.currency,
    _valid_until: input.validUntil,
    _notes: input.notes,
    _request_id: input.requestId,
  });

  if (result.error) throw result.error;
  return result.data!;
}

type CounterOfferResult = Database["public"]["Functions"]["counter_deal_offer"]["Returns"];
type CounterOfferArgs = {
  _parent_offer_id: string;
  _amount: number;
  _currency: string;
  _valid_until: string | null;
  _notes: string | null;
};
type CounterOfferInvoker = (
  args: CounterOfferArgs,
) => PromiseLike<{ data: CounterOfferResult | null; error: unknown }>;

const invokeCounterOffer: CounterOfferInvoker = (args) =>
  supabase.rpc("counter_deal_offer", args as never);

export async function executeCounterOffer(
  input: CounterOfferInput,
  invoke: CounterOfferInvoker = invokeCounterOffer,
): Promise<CounterOfferResult> {
  const result = await invoke({
    _parent_offer_id: input.parentOfferId,
    _amount: input.amount,
    _currency: input.currency,
    _valid_until: input.validUntil,
    _notes: input.notes,
  });

  if (result.error) throw result.error;
  return result.data!;
}
