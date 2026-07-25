import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { AccessDenied } from "@/components/access-denied";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Users, Calendar, FileText, ArrowRight, BedDouble } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/rfqs/")({
  head: () => ({ meta: [{ title: i18n.t("dashboard.requests.metaTitle") }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isOrganizer, loading: rolesLoading } = useRoles();
  const { data: rfqs = [], isLoading } = useQuery({
    queryKey: ["my-rfqs", user?.id],
    enabled: !!user && isOrganizer,
    queryFn: async () => {
      const { data } = await supabase
        .from("rfqs")
        .select("*")
        .eq("organizer_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  if (rolesLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!isOrganizer) return <AccessDenied message={t("dashboard.requests.organizerOnly")} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.myRfqs")}
        icon={FileText}
        actions={
          <Button asChild>
            <Link to="/dashboard/rfqs/new">
              <Plus className="h-4 w-4" /> {t("dashboard.newRfq")}
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : rfqs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("dashboard.noRfqs")}
          description={t("dashboard.requests.emptyDescription")}
          actionLabel={t("dashboard.createFirst")}
          actionTo="/dashboard/rfqs/new"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {rfqs.map((r) => (
            <Link
              key={r.id}
              to="/dashboard/rfqs/$id"
              params={{ id: r.id }}
              className="group block border-b border-border last:border-b-0"
            >
              <Card className="rounded-none border-0 shadow-none transition-colors group-hover:bg-muted/30">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="truncate text-base font-semibold text-foreground">
                          {r.title}
                        </h3>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {r.destination_city},{" "}
                          {r.destination_country}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" /> {r.check_in} → {r.check_out} (
                          {r.nights} {t("dashboard.nights")})
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {r.guests_count} {t("dashboard.guests")}
                        </span>
                        <span className="flex items-center gap-1">
                          <BedDouble className="h-3.5 w-3.5" /> {r.rooms_needed}{" "}
                          {t("dashboard.rooms")}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                      {t("dashboard.details")}
                      <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
