import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Inbox,
  Plus,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard, MetricGrid } from "@/components/workspace/metric-card";
import { PageHeader } from "@/components/workspace/page-header";
import { WorkspaceSection } from "@/components/workspace/section";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: i18n.t("dashboard.meta.title") }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { isHotel, isAdmin, loading } = useRoles();

  if (loading) {
    return (
      <div className="space-y-6" aria-label={t("common.loading")}>
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (isAdmin) return <AdminRedirect />;
  return isHotel ? <HotelHome /> : <OrganizerHome />;
}

function AdminRedirect() {
  const { t } = useTranslation();
  if (typeof window !== "undefined") window.location.replace("/admin");
  return <div className="text-muted-foreground">{t("dashboard.redirectingToAdmin")}</div>;
}

function OrganizerHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ["dash-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ count: total }, { count: open }, { count: awarded }] = await Promise.all([
        supabase
          .from("rfqs")
          .select("*", { count: "exact", head: true })
          .eq("organizer_id", user!.id),
        supabase
          .from("rfqs")
          .select("*", { count: "exact", head: true })
          .eq("organizer_id", user!.id)
          .eq("status", "open"),
        supabase
          .from("rfqs")
          .select("*", { count: "exact", head: true })
          .eq("organizer_id", user!.id)
          .eq("status", "awarded"),
      ]);
      return { total: total ?? 0, open: open ?? 0, awarded: awarded ?? 0 };
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("dashboard.welcome")}
        description={t("hero.subtitle")}
        actions={
          <Button asChild>
            <Link to="/dashboard/rfqs/new">
              <Plus className="h-4 w-4" /> {t("dashboard.newRfq")}
            </Link>
          </Button>
        }
      />

      <MetricGrid className="xl:grid-cols-3">
        <MetricCard
          icon={FileText}
          label={t("dashboard.myRfqs")}
          value={stats?.total ?? 0}
          tone="primary"
        />
        <MetricCard
          icon={Inbox}
          label={t("dashboard.status.open")}
          value={stats?.open ?? 0}
          tone="info"
        />
        <MetricCard
          icon={CheckCircle2}
          label={t("dashboard.status.awarded")}
          value={stats?.awarded ?? 0}
          tone="success"
        />
      </MetricGrid>

      <WorkspaceSection title={t("dashboard.myRfqs")} description={t("hero.subtitle")}>
        <Card>
          <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/5 text-primary">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-foreground">{t("dashboard.myRfqs")}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {t("dashboard.allQuotations")}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild>
                <Link to="/dashboard/rfqs">
                  {t("dashboard.myRfqs")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard/quotations">{t("dashboard.allQuotations")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </WorkspaceSection>
    </div>
  );
}

function HotelHome() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: hotels = [] } = useQuery({
    queryKey: ["my-hotels-summary", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("hotels")
        .select("id, name, status")
        .eq("owner_id", user!.id);
      return data ?? [];
    },
  });

  const hotelIds = hotels.map((hotel) => hotel.id);
  const hasHotels = hotelIds.length > 0;

  const { data: stats } = useQuery({
    queryKey: ["hotel-stats", hotelIds.join(",")],
    enabled: hasHotels,
    queryFn: async () => {
      const [{ count: invites }, { count: quotes }, { count: wins }] = await Promise.all([
        supabase
          .from("rfq_invitations")
          .select("*", { count: "exact", head: true })
          .in("hotel_id", hotelIds),
        supabase
          .from("quotes")
          .select("*", { count: "exact", head: true })
          .in("hotel_id", hotelIds),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .in("hotel_id", hotelIds),
      ]);
      return { invites: invites ?? 0, quotes: quotes ?? 0, wins: wins ?? 0 };
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("dashboard.welcome")}
        description={
          hasHotels ? hotels.map((hotel) => hotel.name).join(", ") : t("hotelDash.needsHotel")
        }
        actions={
          <Button asChild>
            <Link to={hasHotels ? "/dashboard/invitations" : "/dashboard/hotel"}>
              {hasHotels
                ? t("hotelDash.invitations")
                : t("hotelDash.completeProfileTitle", "Complete Your Hotel Profile")}
            </Link>
          </Button>
        }
      />

      <MetricGrid>
        <MetricCard
          icon={Inbox}
          label={t("hotelDash.invitations")}
          value={stats?.invites ?? 0}
          tone="warning"
        />
        <MetricCard
          icon={Send}
          label={t("dashboard.viewQuotes")}
          value={stats?.quotes ?? 0}
          tone="info"
        />
        <MetricCard
          icon={CheckCircle2}
          label={t("dashboard.status.awarded")}
          value={stats?.wins ?? 0}
          tone="success"
        />
        <MetricCard
          icon={CreditCard}
          label={t("dashboard.subscription.active")}
          value={t("dashboard.subscription.free")}
          tone="gold"
        />
      </MetricGrid>

      <WorkspaceSection title={t("nav.hotelProfile")}>
        <Card>
          <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/5 text-primary">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-foreground">{t("nav.hotelProfile")}</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {hasHotels
                    ? hotels
                        .map(
                          (hotel) => `${hotel.name} (${t(`hotelDash.statuses.${hotel.status}`)})`,
                        )
                        .join(" / ")
                    : t("hotelDash.needsHotel")}
                </p>
              </div>
            </div>
            <Button asChild>
              <Link to="/dashboard/hotel">
                {t("nav.hotelProfile")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </WorkspaceSection>
    </div>
  );
}
