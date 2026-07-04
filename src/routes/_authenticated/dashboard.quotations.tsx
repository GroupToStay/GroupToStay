import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/dashboard/quotations")({
  head: () => ({ meta: [{ title: "Quotations — GroupToStay" }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data = [], isLoading } = useQuery({
    queryKey: ["agency-quotations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rfqs } = await supabase
        .from("rfqs")
        .select("id, title, destination_city, destination_country, status")
        .eq("organizer_id", user!.id);
      const rfqIds = (rfqs ?? []).map((r) => r.id);
      if (rfqIds.length === 0) return [];
      const { data: quotes } = await supabase
        .from("quotes")
        .select("*, hotels(name, city, country, star_rating)")
        .in("rfq_id", rfqIds)
        .order("created_at", { ascending: false });
      const byId = new Map((rfqs ?? []).map((r) => [r.id, r]));
      return (quotes ?? []).map((q: any) => ({ ...q, rfq: byId.get(q.rfq_id) }));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-primary">{t("dashboard.allQuotations")}</h1>
        <p className="text-muted-foreground">{t("dashboard.receivedQuotations")}</p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("dashboard.noQuotesYet")}
          description="Hotels will send competitive quotations here once your requests are published."
          actionLabel={t("dashboard.newRfq")}
          actionTo="/dashboard/rfqs/new"
          secondaryLabel={t("dashboard.myRfqs")}
          secondaryTo="/dashboard/rfqs"
        />
      ) : (
        <div className="space-y-3">
          {data.map((q: any) => (
            <Card key={q.id}>
              <CardContent className="p-4 flex flex-wrap items-center gap-4 justify-between">
                <div className="min-w-0">
                  <Link
                    to="/dashboard/rfqs/$id"
                    params={{ id: q.rfq_id }}
                    className="font-medium hover:underline"
                  >
                    {q.rfq?.title ?? "Request"}
                  </Link>
                  <div className="text-sm text-muted-foreground">
                    {q.hotels?.name} · {q.hotels?.city}, {q.hotels?.country}
                  </div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1 text-gold">
                    {Array.from({ length: q.hotels?.star_rating ?? 0 }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-current" />
                    ))}
                  </div>
                </div>
                <div className="text-end">
                  <div className="font-display text-lg text-primary">
                    {q.currency} {Number(q.total_price).toLocaleString()}
                  </div>
                  <Badge variant="outline" className="mt-1">
                    {t(`dashboard.status.${q.status}`)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
