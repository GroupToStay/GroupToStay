import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import type { DealCounterpartyContact } from "@/features/deals/deal-contact-model";

export const dealContactQueryKey = (dealId: string, userId?: string | null) => [
  "deal-counterparty-contact",
  dealId,
  userId ?? "anonymous",
];

type ContactArgs = Database["public"]["Functions"]["get_deal_counterparty_contact"]["Args"];
type ContactResult = Database["public"]["Functions"]["get_deal_counterparty_contact"]["Returns"];
type ContactInvoker = (
  args: ContactArgs,
) => PromiseLike<{ data: ContactResult | null; error: unknown }>;

const invokeContactProjection: ContactInvoker = (args) =>
  supabase.rpc("get_deal_counterparty_contact", args);

export async function loadDealCounterpartyContact(
  dealId: string,
  invoke: ContactInvoker = invokeContactProjection,
): Promise<DealCounterpartyContact | null> {
  const result = await invoke({ _deal_id: dealId });
  if (result.error) throw result.error;
  return result.data?.[0] ?? null;
}
