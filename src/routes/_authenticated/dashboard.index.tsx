import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  FileText,
  Inbox,
  MessageSquare,
  Plus,
  Send,
  Handshake,
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
import { QuickActions } from "@/components/workspace/quick-actions";
import { TaskGrid } from "@/components/workspace/task-card";
import i18n from "@/lib/i18n";
import { dealActivationEnabled } from "@/features/deals/deal-activation-config";

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
      const { data } = await supabase
        .from("rfqs")
        .select("id, status")
        .eq("organizer_id", user!.id);
      const requests = data ?? [];
      const requestIds = requests.map((request) => request.id);
      const [{ count: quotes }, { count: bookings }] = await Promise.all([
        requestIds.length
          ? supabase
              .from("quotes")
              .select("id", { count: "exact", head: true })
              .in("rfq_id", requestIds)
          : Promise.resolve({ count: 0 }),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("organizer_id", user!.id),
      ]);
      return {
        total: requests.length,
        open: requests.filter((request) =>
          ["open", "quoting", "under_review"].includes(request.status),
        ).length,
        awarded: requests.filter((request) => request.status === "awarded").length,
        quotes: quotes ?? 0,
        bookings: bookings ?? 0,
      };
    },
  });

  const tasks = [
    ...(dealActivationEnabled
      ? [
          {
            id: "negotiations",
            title: t("deals:activation.dashboard.title"),
            description: t("deals:activation.dashboard.description"),
            to: "/dashboard/negotiations",
            icon: Handshake,
            tone: "primary" as const,
          },
        ]
      : []),
    {
      id: "active-rfqs",
      title: t("dashboard.tasks.agency.activeRfqs"),
      description: t("dashboard.tasks.agency.activeRfqsDescription"),
      count: stats?.open ?? 0,
      to: "/dashboard/rfqs",
      icon: FileText,
      tone: "info" as const,
    },
    {
      id: "quotes",
      title: t("dashboard.tasks.agency.quotes"),
      description: t("dashboard.tasks.agency.quotesDescription"),
      count: stats?.quotes ?? 0,
      to: "/dashboard/quotations",
      icon: CreditCard,
      tone: "warning" as const,
    },
    {
      id: "bookings",
      title: t("dashboard.tasks.agency.bookings"),
      description: t("dashboard.tasks.agency.bookingsDescription"),
      count: stats?.bookings ?? 0,
      to: "/dashboard/bookings",
      icon: CalendarCheck,
      tone: "success" as const,
    },
    {
      id: "messages",
      title: t("dashboard.tasks.common.messages"),
      description: t("dashboard.tasks.common.messagesDescription"),
      to: "/dashboard/messages",
      icon: MessageSquare,
      tone: "primary" as const,
    },
  ];

  const quickActions = [
    ...(dealActivationEnabled
      ? [
          {
            id: "negotiations",
            label: t("deals:activation.navigation"),
            to: "/dashboard/negotiations",
            icon: Handshake,
          },
        ]
      : []),
    {
      id: "new-rfq",
      label: t("dashboard.newRfq"),
      to: "/dashboard/rfqs/new",
      icon: Plus,
    },
    {
      id: "quotes",
      label: t("nav.receivedOffers"),
      to: "/dashboard/quotations",
      icon: CreditCard,
    },
    {
      id: "bookings",
      label: t("dashboard.bookings.navLabel"),
      to: "/dashboard/bookings",
      icon: CalendarCheck,
    },
    {
      id: "messages",
      label: t("dashboard.messagesTitle"),
      to: "/dashboard/messages",
      icon: MessageSquare,
    },
  ];

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

      <WorkspaceSection
        title={t("dashboard.tasks.title")}
        description={t("dashboard.tasks.description")}
      >
        <TaskGrid tasks={tasks} />
      </WorkspaceSection>

      <WorkspaceSection title={t("dashboard.quickActions.title")}>
        <QuickActions actions={quickActions} />
      </WorkspaceSection>

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
      const [
        { count: invites },
        { count: pendingInvites },
        { count: quotes },
        { count: activeQuotes },
        { count: wins },
      ] = await Promise.all([
        supabase
          .from("rfq_invitations")
          .select("*", { count: "exact", head: true })
          .in("hotel_id", hotelIds),
        supabase
          .from("rfq_invitations")
          .select("*", { count: "exact", head: true })
          .in("hotel_id", hotelIds)
          .in("status", ["pending", "viewed"]),
        supabase
          .from("quotes")
          .select("*", { count: "exact", head: true })
          .in("hotel_id", hotelIds),
        supabase
          .from("quotes")
          .select("*", { count: "exact", head: true })
          .in("hotel_id", hotelIds)
          .in("status", ["submitted", "viewed", "shortlisted"]),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .in("hotel_id", hotelIds),
      ]);
      return {
        invites: invites ?? 0,
        pendingInvites: pendingInvites ?? 0,
        quotes: quotes ?? 0,
        activeQuotes: activeQuotes ?? 0,
        wins: wins ?? 0,
      };
    },
  });

  const tasks = [
    ...(dealActivationEnabled
      ? [
          {
            id: "negotiations",
            title: t("deals:activation.dashboard.title"),
            description: t("deals:activation.dashboard.description"),
            to: "/dashboard/negotiations",
            icon: Handshake,
            tone: "primary" as const,
          },
        ]
      : []),
    {
      id: "invitations",
      title: t("dashboard.tasks.hotel.invitations"),
      description: t("dashboard.tasks.hotel.invitationsDescription"),
      count: stats?.pendingInvites ?? 0,
      to: "/dashboard/invitations",
      icon: Inbox,
      tone: "warning" as const,
    },
    {
      id: "quotations",
      title: t("dashboard.tasks.hotel.quotations"),
      description: t("dashboard.tasks.hotel.quotationsDescription"),
      count: stats?.activeQuotes ?? 0,
      to: "/dashboard/invitations",
      icon: Send,
      tone: "info" as const,
    },
    {
      id: "groups",
      title: t("dashboard.tasks.hotel.upcomingGroups"),
      description: t("dashboard.tasks.hotel.upcomingGroupsDescription"),
      count: stats?.wins ?? 0,
      to: "/dashboard/bookings",
      icon: CalendarCheck,
      tone: "success" as const,
    },
    {
      id: "messages",
      title: t("dashboard.tasks.common.messages"),
      description: t("dashboard.tasks.common.messagesDescription"),
      to: "/dashboard/messages",
      icon: MessageSquare,
      tone: "primary" as const,
    },
  ];

  const quickActions = [
    ...(dealActivationEnabled
      ? [
          {
            id: "negotiations",
            label: t("deals:activation.navigation"),
            to: "/dashboard/negotiations",
            icon: Handshake,
          },
        ]
      : []),
    {
      id: "review-invitations",
      label: t("dashboard.quickActions.hotel.reviewInvitations"),
      to: "/dashboard/invitations",
      icon: Inbox,
    },
    {
      id: "bookings",
      label: t("dashboard.bookings.navLabel"),
      to: "/dashboard/bookings",
      icon: CalendarCheck,
    },
    {
      id: "profile",
      label: t("nav.hotelProfile"),
      to: "/dashboard/hotel",
      icon: Building2,
    },
    {
      id: "messages",
      label: t("dashboard.messagesTitle"),
      to: "/dashboard/messages",
      icon: MessageSquare,
    },
  ];

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

      <WorkspaceSection
        title={t("dashboard.tasks.title")}
        description={t("dashboard.tasks.description")}
      >
        <TaskGrid tasks={tasks} />
      </WorkspaceSection>

      <WorkspaceSection title={t("dashboard.quickActions.title")}>
        <QuickActions actions={quickActions} />
      </WorkspaceSection>

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
