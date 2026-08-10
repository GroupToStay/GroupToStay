import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LockKeyhole, MessageSquareText, RefreshCw, Send } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  canProvisionDealChat,
  canSendDealChatMessage,
  getDealChatSenderOrganization,
  getDealChatSenderSide,
  isOwnDealChatMessage,
} from "@/features/deals/deal-chat-model";
import {
  dealChatQueryKey,
  loadDealChat,
  sendDealMessage,
} from "@/features/deals/deal-chat-service";
import {
  classifyDealWorkspaceError,
  type DealWorkspaceSnapshot,
} from "@/features/deals/deal-workspace-model";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useApplicationLocale } from "@/lib/application-locale";
import { cn } from "@/lib/utils";

const MESSAGE_LIMIT = 4000;

export function DealChatPanel({ snapshot }: { snapshot: DealWorkspaceSnapshot }) {
  const { t } = useTranslation("deals");
  const { user } = useAuth();
  const { formatDateTime } = useApplicationLocale();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const logRef = useRef<HTMLOListElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const followLatestRef = useRef(true);
  const firstPositionRef = useRef(false);
  const senderOrganizationId = getDealChatSenderOrganization(snapshot);
  const canSend = canSendDealChatMessage(snapshot) && Boolean(senderOrganizationId);
  const queryKey = useMemo(
    () => dealChatQueryKey(snapshot.deal.id, user?.id),
    [snapshot.deal.id, user?.id],
  );

  const chatQuery = useQuery({
    queryKey,
    enabled: Boolean(user),
    queryFn: () => loadDealChat(snapshot.deal.id, canProvisionDealChat(snapshot)),
    retry: (failureCount, error) =>
      classifyDealWorkspaceError(error) === "network" && failureCount < 1,
    staleTime: 10_000,
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const conversationId = chatQuery.data?.conversationId;
      if (!conversationId || !senderOrganizationId) throw new Error("Deal Chat is unavailable");
      return sendDealMessage(conversationId, senderOrganizationId, message);
    },
    onMutate: () => setAnnouncement(""),
    onSuccess: async () => {
      setBody("");
      followLatestRef.current = true;
      await queryClient.invalidateQueries({ queryKey });
      setAnnouncement(t("workspace.chat.feedback.sent"));
    },
    onError: async (error) => {
      const kind = classifyDealWorkspaceError(error);
      if (kind === "stale" || kind === "state_changed" || kind === "permission") {
        await queryClient.invalidateQueries({ queryKey });
      }
      setAnnouncement(t(`workspace.chat.errors.${kind}`));
    },
  });

  const conversationId = chatQuery.data?.conversationId;
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`deal-chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => void queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, queryKey]);

  const messageCount = chatQuery.data?.messages.length ?? 0;
  useEffect(() => {
    const log = logRef.current;
    if (!log || messageCount === 0) return;
    if (!firstPositionRef.current || followLatestRef.current) {
      log.scrollTo({
        top: log.scrollHeight,
        behavior: firstPositionRef.current ? "smooth" : "auto",
      });
      firstPositionRef.current = true;
    }
  }, [messageCount]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = body.trim();
    if (!normalized || normalized.length > MESSAGE_LIMIT || sendMutation.isPending) return;
    sendMutation.mutate(normalized);
  }

  function handleLogScroll() {
    const log = logRef.current;
    if (!log) return;
    followLatestRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  }

  if (chatQuery.isLoading) return <DealChatLoading />;
  if (chatQuery.error) {
    const kind = classifyDealWorkspaceError(chatQuery.error);
    return (
      <div className="grid min-h-72 place-items-center rounded-lg border border-border bg-card p-6 text-center">
        <div className="max-w-md">
          <AlertCircle className="mx-auto h-8 w-8 text-error" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-foreground">
            {t("workspace.chat.errorState.title")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">{t(`workspace.chat.errors.${kind}`)}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-5 min-h-11"
            onClick={() => chatQuery.refetch()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t("workspace.chat.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const messages = chatQuery.data?.messages ?? [];
  const readOnly = !canSend;

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-labelledby="deal-chat-title"
    >
      <header className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="deal-chat-title" className="font-semibold text-foreground">
              {t("workspace.chat.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("workspace.chat.description")}</p>
          </div>
        </div>
      </header>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {messages.length === 0 ? (
        <div className="grid min-h-72 place-items-center px-6 py-10 text-center">
          <div className="max-w-sm">
            <MessageSquareText
              className="mx-auto h-8 w-8 text-muted-foreground"
              aria-hidden="true"
            />
            <h3 className="mt-3 font-semibold text-foreground">
              {t("workspace.chat.empty.title")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("workspace.chat.empty.description")}
            </p>
          </div>
        </div>
      ) : (
        <ol
          ref={logRef}
          role="log"
          aria-label={t("workspace.chat.logLabel")}
          aria-live="polite"
          aria-relevant="additions"
          onScroll={handleLogScroll}
          className="max-h-[34rem] min-h-72 space-y-4 overflow-y-auto px-4 py-5 sm:px-5"
        >
          {messages.map((message) => {
            const side = getDealChatSenderSide(snapshot, message);
            const own = isOwnDealChatMessage(snapshot.actor, side);
            return (
              <li key={message.id} className={cn("flex", own ? "justify-end" : "justify-start")}>
                <article
                  className={cn(
                    "max-w-[88%] rounded-lg border px-4 py-3 sm:max-w-[76%]",
                    own ? "border-primary/20 bg-primary/10" : "border-border bg-muted/45",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {t(`workspace.chat.participants.${side}`)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={message.created_at}>{formatDateTime(message.created_at)}</time>
                  </div>
                  <p
                    dir="auto"
                    className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground"
                  >
                    {message.body}
                  </p>
                </article>
              </li>
            );
          })}
        </ol>
      )}

      <div className="border-t border-border p-4 sm:p-5">
        {readOnly ? (
          <Alert>
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{t("workspace.chat.readOnly.title")}</AlertTitle>
            <AlertDescription>{t("workspace.chat.readOnly.description")}</AlertDescription>
          </Alert>
        ) : (
          <form ref={formRef} onSubmit={submit} className="space-y-3">
            <Label htmlFor="deal-chat-message">{t("workspace.chat.composer.label")}</Label>
            <Textarea
              id="deal-chat-message"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
              maxLength={MESSAGE_LIMIT}
              rows={3}
              dir="auto"
              disabled={sendMutation.isPending || !conversationId}
              placeholder={t("workspace.chat.composer.placeholder")}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {t("workspace.chat.composer.privacy")}
              </p>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                  {body.length}/{MESSAGE_LIMIT}
                </span>
                <Button
                  type="submit"
                  variant="gold"
                  className="min-h-11 min-w-28"
                  disabled={!body.trim() || sendMutation.isPending || !conversationId}
                >
                  <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                  {sendMutation.isPending
                    ? t("workspace.chat.composer.sending")
                    : t("workspace.chat.composer.send")}
                </Button>
              </div>
            </div>
          </form>
        )}
        {announcement ? (
          <p className={cn("mt-3 text-sm", sendMutation.isError ? "text-error" : "text-success")}>
            {announcement}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function DealChatLoading() {
  const { t } = useTranslation("deals");
  return (
    <div
      className="space-y-4 rounded-lg border border-border bg-card p-5"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{t("workspace.chat.loading")}</span>
      <div className="h-12 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="h-24 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
    </div>
  );
}
