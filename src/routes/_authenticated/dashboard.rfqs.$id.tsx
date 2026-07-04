import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MapPin,
  Calendar,
  Users,
  Star,
  ArrowLeft,
  MessageSquare,
  Trash2,
  GitCompare,
} from "lucide-react";
import { useApplicationLocale } from "@/lib/application-locale";

export const Route = createFileRoute("/_authenticated/dashboard/rfqs/$id")({
  head: () => ({ meta: [{ title: "Request — GroupToStay" }] }),
  component: Page,
  errorComponent: () => (
    <div className="p-8 text-center text-muted-foreground">Could not load this request.</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-muted-foreground">Request not found.</div>
  ),
});

const statusColor: Record<string, string> = {
  open: "bg-success/15 text-success",
  quoting: "bg-info/15 text-info",
  under_review: "bg-warning/15 text-warning",
  awarded: "bg-gold/20 text-gold-foreground border border-gold/30",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-error/15 text-error",
  draft: "bg-muted text-muted-foreground",
};

function Page() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { formatNumber } = useApplicationLocale();

  const { data, isLoading } = useQuery({
    queryKey: ["rfq", id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rfq } = await supabase.from("rfqs").select("*").eq("id", id).maybeSingle();
      if (!rfq) return null;
      const { data: quotes } = await supabase
        .from("quotes")
        .select("*, hotels(name, city, country, star_rating)")
        .eq("rfq_id", id)
        .order("total_price", { ascending: true });
      return { rfq, quotes: quotes ?? [] };
    },
  });

  const closeMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rfqs").update({ status: "closed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("dashboard.closedToast"));
      qc.invalidateQueries({ queryKey: ["rfq", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rfqs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      window.location.href = "/dashboard/rfqs";
    },
  });

  const updateQuote = useMutation({
    mutationFn: async ({ qid, status }: { qid: string; status: "shortlisted" | "rejected" }) => {
      const { error } = await supabase.from("quotes").update({ status }).eq("id", qid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfq", id] }),
  });

  const acceptQuote = useMutation({
    mutationFn: async (quote: any) => {
      const { error: qErr } = await supabase
        .from("quotes")
        .update({ status: "accepted" })
        .eq("id", quote.id);
      if (qErr) throw qErr;
      const { error: bErr } = await supabase.from("bookings").insert({
        rfq_id: id,
        quote_id: quote.id,
        organizer_id: user!.id,
        hotel_id: quote.hotel_id,
        total_amount: quote.total_price,
        commission_amount: Number(quote.total_price) * 0.1,
      });
      if (bErr) throw bErr;
      const { error: rErr } = await supabase
        .from("rfqs")
        .update({ status: "awarded" })
        .eq("id", id);
      if (rErr) throw rErr;
    },
    onSuccess: () => {
      toast.success(t("dashboard.acceptedToast"));
      qc.invalidateQueries({ queryKey: ["rfq", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Mark freshly received quotations as 'viewed' so hotels get notified.
  useEffect(() => {
    const submitted = data?.quotes?.filter((q: any) => q.status === "submitted") ?? [];
    if (submitted.length === 0) return;
    supabase
      .from("quotes")
      .update({ status: "viewed", viewed_at: new Date().toISOString() } as any)
      .in(
        "id",
        submitted.map((q: any) => q.id),
      )
      .then(() => qc.invalidateQueries({ queryKey: ["rfq", id] }));
  }, [data?.quotes, id, qc]);

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!data) throw notFound();
  const { rfq, quotes } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/dashboard/rfqs"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {t("dashboard.myRfqs")}
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-3xl text-primary">{rfq.title}</h1>
              <Badge className={statusColor[rfq.status]}>
                {t(`dashboard.status.${rfq.status}`)}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {rfq.destination_city}, {rfq.destination_country}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {rfq.check_in} → {rfq.check_out}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {rfq.guests_count} {t("dashboard.guests")} ·{" "}
                {rfq.rooms_needed} {t("dashboard.rooms")}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {["open", "quoting", "under_review"].includes(rfq.status) && (
              <Button variant="outline" size="sm" onClick={() => closeMut.mutate()}>
                {t("dashboard.close")}
              </Button>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Trash2 className="h-4 w-4 text-error" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("dashboard.deleteConfirm")}</DialogTitle>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="destructive" onClick={() => deleteMut.mutate()}>
                    {t("dashboard.deleteConfirm")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-5 grid sm:grid-cols-2 gap-4 text-sm">
          <Detail label={t("rfq.fields.groupType")} value={t(`rfq.groupTypes.${rfq.group_type}`)} />
          <Detail
            label={t("rfq.fields.mealPlan")}
            value={
              rfq.meal_plan_code
                ? t(`rfq.mealPlans.${rfq.meal_plan_code}`)
                : rfq.board_type
                  ? t(`rfq.boards.${rfq.board_type}`)
                  : "—"
            }
          />
          <Detail
            label={t("rfq.fields.accommodation")}
            value={
              rfq.accommodation_type ? t(`rfq.accommodationTypes.${rfq.accommodation_type}`) : "—"
            }
          />
          <Detail
            label={t("rfq.fields.categories")}
            value={
              Array.isArray(rfq.hotel_categories) && rfq.hotel_categories.length > 0
                ? rfq.hotel_categories.map((n: number) => `${n}★`).join(", ")
                : "Any"
            }
          />
          <Detail label={t("rfq.fields.deadline")} value={rfq.deadline || "—"} />
          <Detail
            label={t("rfq.fields.notes")}
            value={rfq.additional_requirements || rfq.special_requirements || "—"}
          />
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-display text-xl text-primary">
            {t("dashboard.viewQuotes")} ({quotes.length})
          </h2>
          <div className="flex gap-2">
            {quotes.length >= 2 && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/rfqs/$id/compare" params={{ id }}>
                  <GitCompare className="h-4 w-4 me-1" /> {t("dashboard.compareQuotes")}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {quotes.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              {t("dashboard.noQuotesYet")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {quotes.map((q: any) => (
              <Card key={q.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-lg text-primary">
                          {q.hotels?.name ?? "Hotel"}
                        </h3>
                        <Badge className={statusColor[q.status] ?? ""}>
                          {t(`dashboard.status.${q.status}`)}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span>
                          {q.hotels?.city}, {q.hotels?.country}
                        </span>
                        <span className="flex text-gold">
                          {Array.from({ length: q.hotels?.star_rating ?? 0 }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-current" />
                          ))}
                        </span>
                        <span>{t(`rfq.boards.${q.board_included}`)}</span>
                      </div>
                      <p className="text-sm mt-2">{q.notes}</p>
                    </div>
                    <div className="text-end">
                      <div className="font-display text-2xl text-primary">
                        {q.currency} {formatNumber(q.total_price)}
                      </div>
                      {q.price_per_room_night && (
                        <div className="text-xs text-muted-foreground">
                          {q.currency} {q.price_per_room_night}
                          {t("hotels.perNight")}
                        </div>
                      )}
                      {["submitted", "viewed", "shortlisted"].includes(q.status) &&
                        ["open", "quoting", "under_review"].includes(rfq.status) && (
                          <div className="flex gap-2 justify-end mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateQuote.mutate({ qid: q.id, status: "shortlisted" })
                              }
                            >
                              {t("dashboard.shortlist")}
                            </Button>
                            <Button size="sm" variant="gold" onClick={() => acceptQuote.mutate(q)}>
                              {t("dashboard.accept")}
                            </Button>
                          </div>
                        )}
                    </div>
                  </div>
                  <MessageThread rfqId={id} otherId={null} hotelName={q.hotels?.name ?? "Hotel"} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-foreground">{value}</div>
    </div>
  );
}

function MessageThread({
  rfqId,
  otherId,
  hotelName,
}: {
  rfqId: string;
  otherId: string | null;
  hotelName: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const { data: msgs = [] } = useQuery({
    queryKey: ["messages", rfqId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("rfq_id", rfqId)
        .order("created_at");
      return data ?? [];
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      if (!text.trim() || !user) return;
      const { error } = await supabase.from("messages").insert({
        rfq_id: rfqId,
        sender_id: user.id,
        recipient_id: otherId ?? user.id, // self-thread placeholder until hotel users exist
        body: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", rfqId] });
    },
  });

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="text-sm font-medium flex items-center gap-2">
        <MessageSquare className="h-4 w-4" /> {hotelName}
      </div>
      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
        {msgs.length === 0 ? (
          <div className="text-xs text-muted-foreground">{t("dashboard.noMessages")}</div>
        ) : (
          msgs.map((m) => (
            <div
              key={m.id}
              className={`text-sm rounded-md px-3 py-2 ${m.sender_id === user?.id ? "bg-primary text-primary-foreground ms-auto max-w-[80%] w-fit" : "bg-muted max-w-[80%] w-fit"}`}
            >
              {m.body}
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("dashboard.messagePh")}
          rows={2}
          maxLength={1000}
        />
        <Button onClick={() => send.mutate()} variant="gold">
          {t("dashboard.sendMessage")}
        </Button>
      </div>
    </div>
  );
}
