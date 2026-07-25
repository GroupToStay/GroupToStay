import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, Hotel as HotelIcon, User as UserIcon, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useApplicationLocale } from "@/lib/application-locale";
import i18n from "@/lib/i18n";
import { PageHeader } from "@/components/workspace/page-header";

export const Route = createFileRoute("/_authenticated/dashboard/messages/")({
  head: () => ({ meta: [{ title: i18n.t("dashboard.messages.centerMetaTitle") }] }),
  component: MessagesIndex,
});

type ConvRow = {
  id: string;
  rfq_id: string;
  hotel_id: string;
  organizer_id: string;
  hotel_owner_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  rfqs?: { title: string | null } | null;
  hotels?: { name: string | null } | null;
  participation?: { last_read_at: string }[];
};

function MessagesIndex() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { formatDateTime } = useApplicationLocale();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      const { data } = await (supabase as any)
        .from("conversations")
        .select(
          "id, rfq_id, hotel_id, organizer_id, hotel_owner_id, last_message_at, last_message_preview, rfqs:rfq_id(title), hotels:hotel_id(name), participation:conversation_participants!inner(last_read_at, user_id)",
        )
        .order("last_message_at", { ascending: false });
      if (cancelled) return;
      // Filter to only this user's participation row for unread comparison
      const rows = (data ?? []).map((c: any) => ({
        ...c,
        participation: (c.participation ?? []).filter((p: any) => p.user_id === userId),
      }));
      setConvs(rows);
      setLoading(false);
    }
    void load();

    const channel = supabase
      .channel(`conv-list:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => void load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return convs;
    return convs.filter((c) => {
      const hotel = c.hotels?.name?.toLowerCase() ?? "";
      const rfq = c.rfqs?.title?.toLowerCase() ?? "";
      const prev = c.last_message_preview?.toLowerCase() ?? "";
      return hotel.includes(q) || rfq.includes(q) || prev.includes(q);
    });
  }, [convs, search]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.messages.centerTitle")} icon={MessageSquare} />
      <Card className="bg-surface/60">
        <CardContent className="p-3">
          <div className="relative max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("dashboard.messages.searchPlaceholder")}
              className="bg-card ps-9"
            />
          </div>
        </CardContent>
      </Card>
      {loading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={
            convs.length === 0
              ? t("dashboard.messages.emptyTitle")
              : t("dashboard.messages.noMatchesTitle")
          }
          description={
            convs.length === 0
              ? t("dashboard.messages.emptyDescription")
              : t("dashboard.messages.noMatchesDescription")
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {filtered.map((c) => {
            const myRead = c.participation?.[0]?.last_read_at;
            const unread = myRead
              ? new Date(c.last_message_at).getTime() > new Date(myRead).getTime()
              : true;
            const isOrganizer = user?.id === c.organizer_id;
            const counterpart = isOrganizer ? c.hotels?.name : t("role.agency");
            const Icon = isOrganizer ? HotelIcon : UserIcon;
            return (
              <Link
                key={c.id}
                to="/dashboard/messages/$id"
                params={{ id: c.id }}
                className={`block border-b border-border transition-colors last:border-b-0 hover:bg-muted/30 ${unread ? "bg-gold/5" : ""}`}
              >
                <div className="flex items-center gap-4 p-4">
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md border border-primary/10 bg-primary/5 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-primary truncate">
                        {counterpart ?? t("dashboard.messages.conversationFallback")}
                      </div>
                      {unread && (
                        <Badge variant="default" className="bg-gold text-primary-foreground">
                          {t("dashboard.messages.new")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t("dashboard.messages.groupRequestLabel")}{" "}
                      {c.rfqs?.title ?? c.rfq_id.slice(0, 8)}
                    </div>
                    <div className="text-sm text-muted-foreground truncate mt-1">
                      {c.last_message_preview ?? "—"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(c.last_message_at)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
