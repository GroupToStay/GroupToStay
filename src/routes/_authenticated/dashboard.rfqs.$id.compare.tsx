import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Star } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useApplicationLocale } from "@/lib/application-locale";

export const Route = createFileRoute("/_authenticated/dashboard/rfqs/$id/compare")({
  head: () => ({ meta: [{ title: "Compare quotations — GroupToStay" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { formatNumber } = useApplicationLocale();

  const { data, isLoading } = useQuery({
    queryKey: ["rfq-compare", id],
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

  const award = useMutation({
    mutationFn: async (q: any) => {
      const { error: qErr } = await supabase
        .from("quotes")
        .update({ status: "accepted" })
        .eq("id", q.id);
      if (qErr) throw qErr;
      const { error: bErr } = await supabase.from("bookings").insert({
        rfq_id: id,
        quote_id: q.id,
        organizer_id: user!.id,
        hotel_id: q.hotel_id,
        total_amount: q.total_price,
        commission_amount: Number(q.total_price) * 0.1,
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
      qc.invalidateQueries({ queryKey: ["rfq-compare", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!data) throw notFound();
  const { rfq, quotes } = data;
  const isLocked = !["open", "quoting", "under_review"].includes(rfq.status);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/dashboard/rfqs/$id"
          params={{ id }}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {rfq.title}
        </Link>
        <h1 className="font-display text-3xl text-primary mt-2">{t("dashboard.compare.title")}</h1>
      </div>

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {t("dashboard.compare.noQuotes")}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="bg-muted/50">
              <tr className="text-start">
                {[
                  t("dashboard.compare.hotel"),
                  t("dashboard.compare.rating"),
                  t("dashboard.compare.location"),
                  t("dashboard.compare.pricePerRoom"),
                  t("dashboard.compare.totalPrice"),
                  t("dashboard.compare.mealPlan"),
                  t("dashboard.compare.services"),
                  t("dashboard.compare.responseTime"),
                  t("dashboard.compare.action"),
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-start font-medium text-muted-foreground border-b border-border"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q: any) => (
                <tr key={q.id} className="hover:bg-muted/30">
                  <td className="px-3 py-3 border-b border-border">
                    <div className="font-medium">{q.hotels?.name ?? "Hotel"}</div>
                    <Badge variant="outline" className="mt-1">
                      {t(`dashboard.status.${q.status}`)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 border-b border-border">
                    <span className="inline-flex text-gold">
                      {Array.from({ length: q.hotels?.star_rating ?? 0 }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-current" />
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-3 border-b border-border">
                    {q.hotels?.city}, {q.hotels?.country}
                  </td>
                  <td className="px-3 py-3 border-b border-border">
                    {q.price_per_room_night
                      ? `${q.currency} ${formatNumber(q.price_per_room_night)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-3 border-b border-border font-display text-base">
                    {q.currency} {formatNumber(q.total_price)}
                  </td>
                  <td className="px-3 py-3 border-b border-border">
                    {q.board_included ? t(`rfq.boards.${q.board_included}`) : "—"}
                  </td>
                  <td className="px-3 py-3 border-b border-border max-w-[280px]">
                    <div className="line-clamp-3 text-muted-foreground">{q.notes || "—"}</div>
                  </td>
                  <td className="px-3 py-3 border-b border-border text-muted-foreground">
                    {q.created_at
                      ? formatDistanceToNow(new Date(q.created_at), { addSuffix: true })
                      : "—"}
                  </td>
                  <td className="px-3 py-3 border-b border-border">
                    <Button
                      size="sm"
                      variant="gold"
                      disabled={isLocked || award.isPending || q.status === "accepted"}
                      onClick={() => award.mutate(q)}
                    >
                      {q.status === "accepted"
                        ? t("dashboard.status.accepted")
                        : t("dashboard.compare.selectWinner")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
