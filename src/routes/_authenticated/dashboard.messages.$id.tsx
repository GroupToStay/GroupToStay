import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Paperclip,
  Send,
  X,
  FileText,
  Image as ImageIcon,
  Download,
} from "lucide-react";
import { ensureNotificationPermission, notify } from "@/lib/notifications";
import { useApplicationLocale } from "@/lib/application-locale";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/messages/$id")({
  head: () => ({ meta: [{ title: i18n.t("dashboard.messages.chatMetaTitle") }] }),
  component: ChatPage,
});

type Attachment = { path: string; name: string; size: number; type: string };
type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachments: Attachment[];
  created_at: string;
};
type Conversation = {
  id: string;
  rfq_id: string;
  quote_id: string | null;
  hotel_id: string;
  organizer_id: string;
  hotel_owner_id: string;
  rfqs?: {
    title: string | null;
    destination_city?: string | null;
    check_in?: string | null;
    check_out?: string | null;
  } | null;
  hotels?: { name: string | null; city?: string | null } | null;
};

function ChatPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { user } = useAuth();
  const userId = user?.id;
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { formatTime } = useApplicationLocale();

  // Request notification permission once on mount.
  useEffect(() => {
    void ensureNotificationPermission();
  }, []);

  // Load conversation & initial messages.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      const { data: c, error: cErr } = await (supabase as any)
        .from("conversations")
        .select(
          "id, rfq_id, quote_id, hotel_id, organizer_id, hotel_owner_id, rfqs:rfq_id(title, destination_city, check_in, check_out), hotels:hotel_id(name, city)",
        )
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (cErr || !c) {
        toast.error(t("dashboard.messages.errors.notFound"));
        return;
      }
      setConv(c as Conversation);

      const { data: ms } = await (supabase as any)
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((ms as ChatMessage[]) ?? []);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
      );

      // Mark conversation as read for this user.
      await (supabase as any)
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", id)
        .eq("user_id", userId);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, t, userId]);

  // Realtime: new messages + typing presence.
  useEffect(() => {
    if (!userId || !conv?.id) return;
    const channel = supabase
      .channel(`conv:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          requestAnimationFrame(() =>
            scrollRef.current?.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: "smooth",
            }),
          );
          if (m.sender_id !== userId) {
            // Mark read
            void (supabase as any)
              .from("conversation_participants")
              .update({ last_read_at: new Date().toISOString() })
              .eq("conversation_id", id)
              .eq("user_id", userId);
            notify(t("dashboard.messages.browserNotification.title"), {
              body: m.body || t("dashboard.messages.browserNotification.attachment"),
              onClick: () => {
                window.location.href = `/dashboard/messages/${id}`;
              },
            });
          }
        },
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        const fromId = (payload.payload as any)?.user_id;
        if (fromId && fromId !== userId) {
          setOtherTyping(true);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setOtherTyping(false), 2000);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [id, userId, conv?.id, t]);

  function broadcastTyping() {
    if (!typingChannelRef.current || !user) return;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id },
    });
  }

  const isOrganizer = useMemo(
    () => user?.id === conv?.organizer_id,
    [user?.id, conv?.organizer_id],
  );
  const counterpart = isOrganizer ? (conv?.hotels?.name ?? t("role.hotel")) : t("role.agency");

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(t("dashboard.messages.errors.fileTooLarge", { name: f.name }));
        return false;
      }
      return true;
    });
    setPendingFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadAttachments(): Promise<Attachment[]> {
    if (pendingFiles.length === 0) return [];
    const uploaded: Attachment[] = [];
    for (const file of pendingFiles) {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (error) {
        toast.error(
          t("dashboard.messages.errors.uploadFailed", {
            name: file.name,
            message: error.message,
          }),
        );
        throw error;
      }
      uploaded.push({ path, name: file.name, size: file.size, type: file.type });
    }
    return uploaded;
  }

  async function handleSend() {
    if (!user || !conv) return;
    if (!body.trim() && pendingFiles.length === 0) return;
    setSending(true);
    try {
      const attachments = await uploadAttachments();
      const { error } = await (supabase as any).from("chat_messages").insert({
        conversation_id: id,
        sender_id: user.id,
        body: body.trim(),
        attachments,
      });
      if (error) throw error;
      setBody("");
      setPendingFiles([]);
    } catch (e: any) {
      toast.error(e?.message ?? t("dashboard.messages.errors.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-180px)] min-h-[560px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-surface/60 p-3">
        <Link
          to="/dashboard/messages"
          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary"
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </Link>
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md border border-primary/10 bg-primary/5 font-semibold text-primary">
          {counterpart.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-foreground">{counterpart}</div>
          <div className="text-xs text-muted-foreground truncate">
            {conv?.rfqs?.title ?? "—"} · {conv?.rfqs?.destination_city ?? ""}
          </div>
        </div>
        {conv?.rfq_id && (
          <Button asChild variant="outline" size="sm">
            <Link to="/requests/$id" params={{ id: conv.rfq_id }}>
              {t("dashboard.messages.viewRequest")}
            </Link>
          </Button>
        )}
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto bg-card px-3 py-4 sm:px-5">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            {t("dashboard.messages.startConversation", { counterpart })}
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className="group flex gap-3 rounded-md px-2 py-2 hover:bg-muted/30">
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-xs font-semibold ${
                  mine
                    ? "border border-primary/10 bg-primary/5 text-primary"
                    : "border border-gold/20 bg-gold/10 text-gold-foreground"
                }`}
              >
                {(mine ? user?.email?.charAt(0) : counterpart.charAt(0))?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold text-foreground">
                    {mine ? user?.email : counterpart}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatTime(m.created_at, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {m.body && (
                  <div className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                    {m.body}
                  </div>
                )}
                {m.attachments?.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {m.attachments.map((a, i) => (
                      <AttachmentItem key={i} att={a} mine={mine} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {otherTyping && (
          <div className="text-xs text-muted-foreground italic">
            {t("dashboard.messages.typing", { counterpart })}
          </div>
        )}
      </div>

      {/* Pending attachments preview */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border bg-surface/60 px-3 py-2">
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-xs">
              <FileText className="h-3 w-3" />
              <span className="truncate max-w-[160px]">{f.name}</span>
              <button
                onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive"
                aria-label={t("dashboard.messages.removeAttachment", { name: f.name })}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-border bg-surface/60 p-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
          onChange={onPickFiles}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("dashboard.messages.attachFiles")}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            broadcastTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={t("dashboard.messages.messagePlaceholder", { counterpart })}
          className="min-h-[44px] max-h-[120px] resize-none"
          disabled={sending}
        />
        <Button
          onClick={() => void handleSend()}
          disabled={sending || (!body.trim() && pendingFiles.length === 0)}
          aria-label={t("dashboard.sendMessage")}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AttachmentItem({ att, mine }: { att: Attachment; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = att.type?.startsWith("image/");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage
        .from("chat-attachments")
        .createSignedUrl(att.path, 3600);
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [att.path]);

  if (isImage && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={att.name}
          width={240}
          height={200}
          loading="lazy"
          decoding="async"
          className="max-w-[240px] max-h-[200px] rounded-md object-cover border border-border"
        />
      </a>
    );
  }
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs ${mine ? "bg-primary-foreground/10" : "bg-muted"}`}
    >
      {isImage ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
      <span className="truncate max-w-[180px]">{att.name}</span>
      <Download className="h-3 w-3 ml-auto" />
    </a>
  );
}
