import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, Hotel as HotelIcon, User as UserIcon, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/dashboard/messages/")({
  head: () => ({ meta: [{ title: "Negotiation Center — GroupToStay" }] }),
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
  const { user } = useAuth();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const { data } = await (supabase as any)
        .from("conversations")
        .select("id, rfq_id, hotel_id, organizer_id, hotel_owner_id, last_message_at, last_message_preview, rfqs:rfq_id(title), hotels:hotel_id(name), participation:conversation_participants!inner(last_read_at, user_id)")
        .order("last_message_at", { ascending: false });
      if (cancelled) return;
      // Filter to only this user's participation row for unread comparison
      const rows = (data ?? []).map((c: any) => ({
        ...c,
        participation: (c.participation ?? []).filter((p: any) => p.user_id === user!.id),
      }));
      setConvs(rows);
      setLoading(false);
    }
    void load();

    const channel = supabase
      .channel(`conv-list:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => void load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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
    <div>
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="font-display text-3xl text-primary">Negotiation Center</h1>
      </div>
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by hotel, request, or message…"
          className="pl-9"
        />
      </div>
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={convs.length === 0 ? "No conversations yet" : "No matching conversations"}
          description={
            convs.length === 0
              ? "Conversations are created automatically when a hotel submits a quotation on one of your requests."
              : "Try a different hotel, request, or keyword."
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((c) => {
            const myRead = c.participation?.[0]?.last_read_at;
            const unread = myRead ? new Date(c.last_message_at).getTime() > new Date(myRead).getTime() : true;
            const isOrganizer = user?.id === c.organizer_id;
            const counterpart = isOrganizer ? c.hotels?.name : "Organizer";
            const Icon = isOrganizer ? HotelIcon : UserIcon;
            return (
              <Link key={c.id} to="/dashboard/messages/$id" params={{ id: c.id }} className="block">
                <Card className={`transition hover:border-primary ${unread ? "border-gold/60 bg-gold/5" : ""}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-gold flex-shrink-0">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-primary truncate">{counterpart ?? "Conversation"}</div>
                        {unread && <Badge variant="default" className="bg-gold text-primary-foreground">New</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">Group Request: {c.rfqs?.title ?? c.rfq_id.slice(0, 8)}</div>
                      <div className="text-sm text-muted-foreground truncate mt-1">{c.last_message_preview ?? "—"}</div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(c.last_message_at).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
