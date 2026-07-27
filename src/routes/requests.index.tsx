import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar, Users, ArrowRight, Inbox } from "lucide-react";
import { useRoles } from "@/hooks/use-role";
import { EmptyState } from "@/components/empty-state";
import { useApplicationLocale } from "@/lib/application-locale";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/requests/")({
  head: () => ({
    meta: [
      { title: i18n.t("rfq.publicRequests.metaTitle") },
      {
        name: "description",
        content: i18n.t("rfq.publicRequests.metaDescription"),
      },
      { property: "og:title", content: i18n.t("rfq.publicRequests.metaTitle") },
      {
        property: "og:description",
        content: i18n.t("rfq.publicRequests.metaOgDescription"),
      },
    ],
  }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { isOrganizer, loading } = useRoles();
  const { compare, formatDate, formatNumber } = useApplicationLocale();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("__any");
  const [type, setType] = useState("__any");

  const { data: rfqs = [] } = useQuery({
    queryKey: ["public-requests"],
    enabled: !loading && !isOrganizer,
    queryFn: async () => {
      const { data } = await supabase
        .from("rfqs")
        .select(
          "id,title,group_type,destination_city,destination_country,check_in,check_out,nights,guests_count,rooms_needed,board_type,deadline,created_at",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const cities = useMemo(
    () => Array.from(new Set(rfqs.map((r) => r.destination_city))).sort(compare),
    [compare, rfqs],
  );
  const types = useMemo(
    () => Array.from(new Set(rfqs.map((r) => r.group_type))).sort(compare),
    [compare, rfqs],
  );
  const filtered = rfqs.filter((r) => {
    if (city !== "__any" && r.destination_city !== city) return false;
    if (type !== "__any" && r.group_type !== type) return false;
    if (
      q &&
      !`${r.title} ${r.destination_city} ${r.destination_country}`
        .toLowerCase()
        .includes(q.toLowerCase())
    )
      return false;
    return true;
  });

  if (!loading && isOrganizer) {
    return <Navigate to="/dashboard/rfqs" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-primary/10 bg-primary text-primary-foreground">
          <div className="container-page py-10 sm:py-12">
            <h1 className="text-3xl font-semibold md:text-4xl">{t("rfq.publicRequests.title")}</h1>
            <p className="mt-2 text-primary-foreground/80">{t("rfq.publicRequests.subtitle")}</p>
          </div>
        </section>

        <div className="container-page py-6 grid md:grid-cols-[1fr_200px_200px] gap-3 sticky top-16 bg-background z-30 border-b border-border">
          <Input
            placeholder={t("rfq.publicRequests.searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger>
              <SelectValue placeholder={t("rfq.publicRequests.destinationPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any">{t("rfq.publicRequests.anyDestination")}</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder={t("rfq.publicRequests.groupTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any">{t("rfq.publicRequests.anyType")}</SelectItem>
              {types.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="container-page py-10">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={t("rfq.publicRequests.emptyTitle")}
              description={t("rfq.publicRequests.emptyDescription")}
              actionLabel={t("rfq.publicRequests.dashboardAction")}
              actionTo="/dashboard"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((r) => (
                <Link key={r.id} to="/requests/$id" params={{ id: r.id }}>
                  <Card className="h-full border-border transition-colors hover:border-primary/30 hover:bg-muted/20">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge className="bg-success/15 text-success border-0 uppercase tracking-wide">
                          {r.group_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(r.created_at)}
                        </span>
                      </div>
                      <h3 className="line-clamp-2 text-lg font-semibold text-foreground">
                        {r.title}
                      </h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> {r.destination_city},{" "}
                          {r.destination_country}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" /> {r.check_in} - {r.check_out} (
                          {t("rfq.publicRequests.nightsShort", { count: r.nights })})
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> {formatNumber(r.guests_count)}{" "}
                          {t("dashboard.guests")} / {formatNumber(r.rooms_needed)}{" "}
                          {t("dashboard.rooms")}
                        </div>
                      </div>
                      <div className="pt-2 text-sm text-primary font-medium inline-flex items-center gap-1">
                        {t("rfq.publicRequests.viewRespond")}{" "}
                        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
