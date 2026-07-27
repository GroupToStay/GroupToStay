import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Star, ClipboardList, MapPin, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useApplicationLocale } from "@/lib/application-locale";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/quotations")({
  head: () => ({ meta: [{ title: i18n.t("dashboard.quotations.metaTitle") }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { formatNumber } = useApplicationLocale();

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
      <PageHeader
        title={t("dashboard.allQuotations")}
        description={t("dashboard.receivedQuotations")}
        icon={ClipboardList}
      />

      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("dashboard.noQuotesYet")}
          description={t("dashboard.quotations.emptyDescription")}
          actionLabel={t("dashboard.newRfq")}
          actionTo="/dashboard/rfqs/new"
          secondaryLabel={t("dashboard.myRfqs")}
          secondaryTo="/dashboard/rfqs"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {data.map((q: any) => (
            <Card
              key={q.id}
              className="rounded-none border-x-0 border-t-0 shadow-none last:border-b-0"
            >
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link
                    to="/dashboard/rfqs/$id"
                    params={{ id: q.rfq_id }}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {q.rfq?.title ?? t("dashboard.quotations.requestFallback")}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{q.hotels?.name}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {q.hotels?.city}, {q.hotels?.country}
                    </span>
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-gold">
                    {Array.from({ length: q.hotels?.star_rating ?? 0 }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-current" />
                    ))}
                  </div>
                </div>
                <div className="text-end">
                  <div className="font-display text-lg text-primary">
                    {q.currency} {formatNumber(q.total_price)}
                  </div>
                  <StatusBadge status={q.status} className="mt-2" />
                  <Link
                    to="/dashboard/rfqs/$id"
                    params={{ id: q.rfq_id }}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
                  >
                    {t("dashboard.details")}
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
