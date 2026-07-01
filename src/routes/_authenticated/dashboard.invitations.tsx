import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Inbox, MapPin, Calendar, Users, Building2, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/dashboard/invitations")({
  head: () => ({ meta: [{ title: "Invitations — GroupToStay" }] }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const list = (roles ?? []).map(r => r.role);
    if (list.includes("admin") || !list.includes("hotel")) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: hotels = [] } = useQuery({
    queryKey: ["my-hotels-min", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("hotels").select("id, name, status").eq("owner_id", user!.id);
      return data ?? [];
    },
  });

  const hotelIds = hotels.filter((h: any) => h.status === "approved").map((h: any) => h.id);
  const hotelById = Object.fromEntries(hotels.map((h: any) => [h.id, h]));

  const { data: invitations = [], isLoading, error } = useQuery({
    queryKey: ["hotel-invitations", hotelIds.join(",")],
    enabled: hotelIds.length > 0,
    queryFn: async () => {
      const { data: invs, error: invErr } = await supabase
        .from("rfq_invitations")
        .select("*, rfqs(*)")
        .in("hotel_id", hotelIds)
        .order("created_at", { ascending: false });
      if (invErr) throw invErr;
      const rows = invs ?? [];
      const rfqIds = rows.map((r: any) => r.rfq_id).filter(Boolean);
      let quotes: any[] = [];
      if (rfqIds.length > 0) {
        const { data: qs } = await supabase
          .from("quotes")
          .select("id, rfq_id, status, hotel_id, total_price, currency")
          .in("rfq_id", rfqIds)
          .in("hotel_id", hotelIds);
        quotes = qs ?? [];
      }
      return rows.map((inv: any) => ({
        ...inv,
        myQuote: quotes.find((q) => q.rfq_id === inv.rfq_id && q.hotel_id === inv.hotel_id) ?? null,
      }));
    },
  });

  if (error) {
    console.error("Group Requests load error:", error);
  }

  if (hotels.length === 0) {
    return (
      <Card><CardContent className="p-10 text-center">
        <Inbox className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="mt-3 text-muted-foreground">{t("hotelDash.needsHotel")}</p>
      </CardContent></Card>
    );
  }

  const approvedHotels = hotels.filter((h: any) => h.status === "approved");
  if (approvedHotels.length === 0) {
    return (
      <Card><CardContent className="p-10 text-center">
        <Inbox className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="mt-3 text-muted-foreground">
          {t("hotelDash.profileNotApprovedYet", "Complete and verify your hotel profile before participating in Group Requests. Only approved hotels may receive Group Requests and submit quotations.")}
        </p>
      </CardContent></Card>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-primary">{t("hotelDash.invitations")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("hotelDash.invitationsSubtitle")}</p>

      {isLoading ? <div className="mt-6 text-muted-foreground">{t("common.loading")}</div> :
        invitations.length === 0 ? (
          <Card className="mt-6"><CardContent className="p-10 text-center text-muted-foreground">{t("hotelDash.noInvitations")}</CardContent></Card>
        ) : (
          <div className="mt-6 space-y-3">
            {invitations.map((inv: any) => (
              <InvitationCard key={inv.id} inv={inv} hotelName={hotelById[inv.hotel_id]?.name ?? ""} />
            ))}
          </div>
        )
      }
    </div>
  );
}

function InvitationCard({ inv, hotelName }: { inv: any; hotelName: string }) {
  const { t } = useTranslation();
  const rfq = inv.rfqs;
  if (!rfq) return null;
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg text-primary">{rfq.title}</h3>
            <Badge className={rfq.status === "open" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>{t(`dashboard.status.${rfq.status}`)}</Badge>
            {inv.myQuote && <Badge className="bg-gold/20 text-gold-foreground border border-gold/30">{t(`dashboard.status.${inv.myQuote.status}`)}</Badge>}
          </div>
          {hotelName && <div className="mt-1 text-xs text-muted-foreground">{t("hotelDash.forHotel")}: <span className="font-medium text-foreground">{hotelName}</span></div>}
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {rfq.destination_city}, {rfq.destination_country}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {rfq.check_in} → {rfq.check_out} ({rfq.nights} {t("dashboard.nights")})</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {rfq.guests_count} {t("dashboard.guests")} · {rfq.rooms_needed} {t("dashboard.rooms")}</span>
          </div>
          {rfq.special_requirements && <p className="mt-2 text-sm">{rfq.special_requirements}</p>}
          <div className="mt-2 text-sm text-muted-foreground">
            {t("rfq.fields.board")}: {t(`rfq.boards.${rfq.board_type}`)}
            {rfq.budget_max && <> · {t("rfq.fields.budgetMax")}: {rfq.budget_max} {rfq.currency}</>}
          </div>
        </div>
        <div className="text-end">
          {inv.myQuote ? (
            <div>
              <div className="font-display text-xl text-primary">{inv.myQuote.currency} {Number(inv.myQuote.total_price).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">{t("hotelDash.quoteSubmitted")}</div>
            </div>
          ) : rfq.status === "open" ? (
            <QuoteDialog rfq={rfq} hotelId={inv.hotel_id} />
          ) : null}
        </div>
      </div>
    </CardContent></Card>
  );
}

function QuoteDialog({ rfq, hotelId }: { rfq: any; hotelId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [totalPrice, setTotalPrice] = useState("");
  const [perNight, setPerNight] = useState("");
  const [board, setBoard] = useState<string>(rfq.board_type);
  const [validUntil, setValidUntil] = useState("");
  const [inclusions, setInclusions] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("quotes").insert({
        rfq_id: rfq.id, hotel_id: hotelId,
        total_price: Number(totalPrice),
        price_per_room_night: perNight ? Number(perNight) : null,
        currency: rfq.currency,
        board_included: board as any,
        valid_until: validUntil || null,
        inclusions: inclusions || null,
        notes: notes || null,
      });
      if (error) throw error;
      toast.success(t("hotelDash.quoteSentToast"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["hotel-invitations"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="gold" size="sm">{t("hotelDash.submitQuote")}</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("hotelDash.submitQuote")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>{t("hotelDash.fields.totalPrice")} ({rfq.currency})</Label><Input type="number" min={0} value={totalPrice} onChange={e => setTotalPrice(e.target.value)} /></div>
          <div><Label>{t("hotelDash.fields.perNight")} ({rfq.currency})</Label><Input type="number" min={0} value={perNight} onChange={e => setPerNight(e.target.value)} /></div>
          <div><Label>{t("rfq.fields.board")}</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={board} onChange={e => setBoard(e.target.value)}>
              {["room_only","breakfast","half_board","full_board"].map(b => <option key={b} value={b}>{t(`rfq.boards.${b}`)}</option>)}
            </select>
          </div>
          <div><Label>{t("hotelDash.fields.validUntil")}</Label><Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
          <div><Label>{t("hotelDash.fields.inclusions")}</Label><Input value={inclusions} onChange={e => setInclusions(e.target.value)} maxLength={500} /></div>
          <div><Label>{t("hotelDash.fields.notes")}</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} /></div>
        </div>
        <DialogFooter>
          <Button variant="gold" onClick={submit} disabled={!totalPrice || submitting}>
            {submitting ? t("rfq.submitting") : t("hotelDash.submitQuote")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
