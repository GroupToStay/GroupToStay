import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Inbox, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GroupToStay" }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ["dash-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ count: total }, { count: open }, { count: awarded }] = await Promise.all([
        supabase.from("rfqs").select("*", { count: "exact", head: true }).eq("organizer_id", user!.id),
        supabase.from("rfqs").select("*", { count: "exact", head: true }).eq("organizer_id", user!.id).eq("status", "open"),
        supabase.from("rfqs").select("*", { count: "exact", head: true }).eq("organizer_id", user!.id).eq("status", "awarded"),
      ]);
      return { total: total ?? 0, open: open ?? 0, awarded: awarded ?? 0 };
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl text-primary">{t("dashboard.welcome")}</h1>
        <Button asChild variant="gold"><Link to="/dashboard/rfqs/new"><Plus className="h-4 w-4" /> {t("dashboard.newRfq")}</Link></Button>
      </div>

      <div className="mt-6 grid sm:grid-cols-3 gap-4">
        {[
          { icon: FileText, label: t("dashboard.myRfqs"), value: stats?.total ?? 0 },
          { icon: Inbox, label: t("dashboard.status.open"), value: stats?.open ?? 0 },
          { icon: CheckCircle2, label: t("dashboard.status.awarded"), value: stats?.awarded ?? 0 },
        ].map((s, i) => (
          <Card key={i}><CardContent className="p-5 flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-gold"><s.icon className="h-5 w-5" /></span>
            <div>
              <div className="text-2xl font-display text-primary">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          </CardContent></Card>
        ))}
      </div>

      <Card className="mt-6"><CardContent className="p-6">
        <h2 className="font-display text-xl text-primary">{t("dashboard.myRfqs")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("hero.subtitle")}</p>
        <div className="mt-4"><Button asChild variant="default"><Link to="/dashboard/rfqs">{t("dashboard.myRfqs")}</Link></Button></div>
      </CardContent></Card>
    </div>
  );
}
