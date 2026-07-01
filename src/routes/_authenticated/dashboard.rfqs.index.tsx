import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { AccessDenied } from "@/components/access-denied";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Users, Calendar, FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/dashboard/rfqs/")({
  head: () => ({ meta: [{ title: "My requests — GroupToStay" }] }),
  component: Page,
});

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
  awarded: "bg-gold/20 text-gold-foreground border border-gold/30",
  cancelled: "bg-error/15 text-error",
};

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isOrganizer, loading: rolesLoading } = useRoles();
  const { data: rfqs = [], isLoading } = useQuery({
    queryKey: ["my-rfqs", user?.id],
    enabled: !!user && isOrganizer,
    queryFn: async () => {
      const { data } = await supabase.from("rfqs").select("*").eq("organizer_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  if (rolesLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!isOrganizer) return <AccessDenied message="Only organizers can view group requests." />;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl text-primary">{t("dashboard.myRfqs")}</h1>
        <Button asChild variant="gold"><Link to="/dashboard/rfqs/new"><Plus className="h-4 w-4" /> {t("dashboard.newRfq")}</Link></Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground mt-8">{t("common.loading")}</div>
      ) : rfqs.length === 0 ? (
        <Card className="mt-8"><CardContent className="p-10 text-center">
          <p className="text-muted-foreground">{t("dashboard.noRfqs")}</p>
          <Button asChild variant="gold" className="mt-4"><Link to="/dashboard/rfqs/new">{t("dashboard.createFirst")}</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="mt-6 space-y-3">
          {rfqs.map(r => (
            <Link key={r.id} to="/dashboard/rfqs/$id" params={{ id: r.id }}>
              <Card className="hover:shadow-[var(--shadow-elevated)] transition"><CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-lg text-primary truncate">{r.title}</h3>
                      <Badge className={statusColor[r.status] ?? ""}>{t(`dashboard.status.${r.status}`)}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {r.destination_city}, {r.destination_country}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {r.check_in} → {r.check_out} ({r.nights} {t("dashboard.nights")})</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {r.guests_count} {t("dashboard.guests")} · {r.rooms_needed} {t("dashboard.rooms")}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">{t("dashboard.details")} →</Button>
                </div>
              </CardContent></Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
