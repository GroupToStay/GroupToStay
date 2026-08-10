import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import type { DealChatMessage, DealChatSnapshot } from "@/features/deals/deal-chat-model";

export const dealChatQueryKey = (dealId: string, userId?: string | null) => [
  "deal-chat",
  dealId,
  userId ?? "anonymous",
];

type EnsureDealConversationResult =
  Database["public"]["Functions"]["ensure_deal_conversation"]["Returns"];

export async function loadDealChat(
  dealId: string,
  provisionWhenMissing: boolean,
): Promise<DealChatSnapshot> {
  const conversationResult = await supabase
    .from("conversations")
    .select("id, deal_id")
    .eq("deal_id", dealId)
    .maybeSingle();

  if (conversationResult.error) throw conversationResult.error;

  let conversationId = conversationResult.data?.id ?? null;
  if (!conversationId && provisionWhenMissing) {
    const { data, error } = await supabase.rpc("ensure_deal_conversation", {
      _deal_id: dealId,
    });
    if (error) throw error;
    conversationId = data as EnsureDealConversationResult;
  }

  if (!conversationId) return { conversationId: null, messages: [] };

  const messagesResult = await supabase
    .from("chat_messages")
    .select("id, conversation_id, sender_organization_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (messagesResult.error) throw messagesResult.error;
  return {
    conversationId,
    messages: (messagesResult.data ?? []) as DealChatMessage[],
  };
}

type SendDealMessageResult = Database["public"]["Functions"]["send_deal_message"]["Returns"];
type SendDealMessageInvoker = (
  args: Database["public"]["Functions"]["send_deal_message"]["Args"],
) => PromiseLike<{ data: SendDealMessageResult | null; error: unknown }>;

const invokeSendDealMessage: SendDealMessageInvoker = (args) =>
  supabase.rpc("send_deal_message", args);

export async function sendDealMessage(
  conversationId: string,
  senderOrganizationId: string,
  body: string,
  invoke: SendDealMessageInvoker = invokeSendDealMessage,
) {
  const result = await invoke({
    _conversation_id: conversationId,
    _sender_organization_id: senderOrganizationId,
    _body: body,
  });
  if (result.error) throw result.error;
  return result.data!;
}
