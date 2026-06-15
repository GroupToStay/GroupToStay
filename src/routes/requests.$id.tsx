import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Calendar, Users, ArrowLeft, MessageSquare, LogIn, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/requests/$id")({
  head: () => ({ meta: [{ title: "Group request — GroupToStay" }] }),
  component: Page,
  errorComponent: () => <div className="p-8 text-center text-muted-foreground">Could not load this request.</div>,
  notFoundComponent: () => <div className="p-8 text-center text-muted-foreground">Request not found.</div>,
});

function Page() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { isHotel, isOrganizer } = useRoles();

  const { data: rfq, isLoading } = useQuery({
    queryKey: ["public-rfq", id],
    queryFn: async () => {
      const { data } = await supabase.from("rfqs").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <div className="container-page py-20 text-muted-foreground">Loading…</div>;
  if (!rfq) throw notFound();

  const isOwner = user?.id === rfq.organizer_id;
  const canMessage = !!user && (isHotel || isOwner);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container-page py-10 space-y-6">
        <Link to="/requests" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> All requests
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-3xl text-primary">{rfq.title}</h1>
              <Badge className="bg-success/15 text-success">{rfq.status}</Badge>
              <Badge variant="outline" className="uppercase tracking-wide">{rfq.group_type}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {rfq.destination_city}, {rfq.destination_country}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {rfq.check_in} → {rfq.check_out} ({rfq.nights}n)</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {rfq.guests_count} guests · {rfq.rooms_needed} rooms</span>
            </div>
          </div>
          {user && isHotel && rfq.status === "open" && (
            <SubmitQuoteForHotel rfq={rfq} userId={user.id} />
          )}
        </div>

        <Card>
          <CardContent className="p-5 grid sm:grid-cols-2 gap-4 text-sm">
            <Detail label="Board" value={rfq.board_type} />
            <Detail label="Room preference" value={rfq.room_type_pref || "—"} />
            <Detail label="Budget" value={`${rfq.budget_min ?? "—"} – ${rfq.budget_max ?? "—"} ${rfq.currency}`} />
            <Detail label="Deadline" value={rfq.deadline || "—"} />
            <div className="sm:col-span-2">
              <Detail label="Special requirements" value={rfq.special_requirements || "—"} />
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="font-display text-xl text-primary mb-3 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Message the organizer
          </h2>

          {!user ? (
            <Card><CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-muted-foreground">Sign in as a hotel to message this organizer and respond to the request.</p>
              <Button asChild variant="gold"><Link to="/auth"><LogIn className="h-4 w-4" /> Sign in</Link></Button>
            </CardContent></Card>
          ) : canMessage ? (
            <Conversation rfqId={id} rfqOrganizerId={rfq.organizer_id} viewerId={user.id} isOwner={isOwner} />
          ) : (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">
              Only hotel accounts can contact organizers about open requests.
              {isOrganizer && " You're signed in as an organizer."}
            </CardContent></Card>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-0.5 text-foreground">{value}</div></div>;
}

function Conversation({ rfqId, rfqOrganizerId, viewerId, isOwner }: { rfqId: string; rfqOrganizerId: string; viewerId: string; isOwner: boolean }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  // If hotel viewer: thread is between this hotel and organizer.
  // If organizer (owner) viewer: show all messages on RFQ; reply to currently selected hotel.
  const { data: msgs = [] } = useQuery({
    queryKey: ["public-rfq-messages", rfqId, viewerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id,body,created_at,sender_id,recipient_id")
        .eq("rfq_id", rfqId)
        .order("created_at");
      return data ?? [];
    },
  });

  // For organizer: list of unique hotel user IDs that have messaged.
  const hotelIds = isOwner
    ? Array.from(new Set(msgs.flatMap(m => [m.sender_id, m.recipient_id]).filter(id => id !== rfqOrganizerId)))
    : [];
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);
  useEffect(() => {
    if (isOwner && !activeHotelId && hotelIds.length > 0) setActiveHotelId(hotelIds[0]);
  }, [isOwner, activeHotelId, hotelIds]);

  const threadMsgs = isOwner
    ? msgs.filter(m => activeHotelId && (m.sender_id === activeHotelId || m.recipient_id === activeHotelId))
    : msgs.filter(m => m.sender_id === viewerId || m.recipient_id === viewerId);

  const send = useMutation({
    mutationFn: async () => {
      if (!text.trim()) return;
      const recipient_id = isOwner ? activeHotelId : rfqOrganizerId;
      if (!recipient_id) throw new Error("No recipient");
      const { error } = await supabase.from("messages").insert({
        rfq_id: rfqId, sender_id: viewerId, recipient_id, body: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["public-rfq-messages", rfqId, viewerId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            {hotelIds.length === 0 ? (
              <span className="text-sm text-muted-foreground">No hotels have messaged yet.</span>
            ) : (
              hotelIds.map(hid => (
                <Button key={hid} size="sm" variant={hid === activeHotelId ? "default" : "outline"} onClick={() => setActiveHotelId(hid)}>
                  Hotel {hid.slice(0, 8)}
                </Button>
              ))
            )}
          </div>
        )}

        <div className="space-y-2 max-h-72 overflow-y-auto rounded-md bg-muted/30 p-3 min-h-[80px]">
          {threadMsgs.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">
              {isOwner ? "No messages in this conversation yet." : "Start the conversation — introduce your hotel and ask any clarifying questions."}
            </div>
          ) : threadMsgs.map(m => (
            <div key={m.id} className={`text-sm rounded-md px-3 py-2 max-w-[80%] w-fit ${m.sender_id === viewerId ? "bg-primary text-primary-foreground ms-auto" : "bg-background border border-border"}`}>
              {m.body}
              <div className={`text-[10px] mt-1 ${m.sender_id === viewerId ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {new Date(m.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {(!isOwner || activeHotelId) && (
          <div className="flex gap-2">
            <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write a message…" rows={2} maxLength={1000} />
            <Button onClick={() => send.mutate()} variant="gold" disabled={!text.trim() || send.isPending}>Send</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
