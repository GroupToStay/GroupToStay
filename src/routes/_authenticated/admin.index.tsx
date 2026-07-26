import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  Hotel,
  Users,
  CreditCard,
  ShieldCheck,
  Inbox,
  BadgeCheck,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import i18n from "@/lib/i18n";
import { PageHeader } from "@/components/workspace/page-header";
import { WorkspaceSection } from "@/components/workspace/section";
import { QuickActions } from "@/components/workspace/quick-actions";
import { TaskGrid } from "@/components/workspace/task-card";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: i18n.t("admin.overview.metaTitle") }] }),
  component: AdminHome,
});

function AdminHome() {
  const { t } = useTranslation();
  const { data: stats } = useQuery({
    queryKey: ["admin-home-stats"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [
        companiesTotal,
        companiesApproved,
        companiesPending,
        companiesRejected,
        listingsTotal,
        listingsApproved,
        listingsPending,
        rolesAgency,
        agenciesPending,
        rolesHotel,
        subActive,
        subWaiting,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .not("hotel_approval_status", "is", null),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("hotel_approval_status", "approved"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("hotel_approval_status", "pending"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("hotel_approval_status", "rejected"),
        supabase.from("hotels").select("id", { count: "exact", head: true }),
        supabase
          .from("hotels")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved"),
        supabase
          .from("hotels")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "organizer"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("agency_verification_status", ["submitted", "pending_review"]),
        supabase
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "hotel"),
        supabase
          .from("subscription_interest")
          .select("id", { count: "exact", head: true })
          .eq("status", "notified"),
        supabase
          .from("subscription_interest")
          .select("id", { count: "exact", head: true })
          .eq("status", "waiting"),
      ]);
      return {
        companiesTotal: companiesTotal.count ?? 0,
        companiesApproved: companiesApproved.count ?? 0,
        companiesPending: companiesPending.count ?? 0,
        companiesRejected: companiesRejected.count ?? 0,
        listingsTotal: listingsTotal.count ?? 0,
        listingsApproved: listingsApproved.count ?? 0,
        listingsPending: listingsPending.count ?? 0,
        agencies: rolesAgency.count ?? 0,
        agenciesPending: agenciesPending.count ?? 0,
        hotelUsers: rolesHotel.count ?? 0,
        subActive: subActive.count ?? 0,
        subWaiting: subWaiting.count ?? 0,
      };
    },
  });

  const sections: {
    title: string;
    tint: string;
    icon: typeof Building2;
    cards: { label: string; value: number | string }[];
  }[] = [
    {
      title: t("admin.overview.sections.hotels"),
      tint: "text-brand-blue bg-brand-blue/10",
      icon: Building2,
      cards: [
        {
          label: t("admin.overview.metrics.totalHotelCompanies"),
          value: stats?.companiesTotal ?? 0,
        },
        { label: t("admin.overview.metrics.approvedHotels"), value: stats?.companiesApproved ?? 0 },
        { label: t("admin.overview.metrics.pendingHotels"), value: stats?.companiesPending ?? 0 },
        { label: t("admin.overview.metrics.rejectedHotels"), value: stats?.companiesRejected ?? 0 },
      ],
    },
    {
      title: t("admin.overview.sections.listings"),
      tint: "text-premium bg-premium/15",
      icon: Hotel,
      cards: [
        { label: t("admin.overview.metrics.totalListings"), value: stats?.listingsTotal ?? 0 },
        { label: t("admin.overview.metrics.activeListings"), value: stats?.listingsApproved ?? 0 },
        { label: t("admin.overview.metrics.pendingListings"), value: stats?.listingsPending ?? 0 },
      ],
    },
    {
      title: t("admin.overview.sections.users"),
      tint: "text-success bg-success/10",
      icon: Users,
      cards: [
        { label: t("admin.overview.metrics.totalAgencies"), value: stats?.agencies ?? 0 },
        { label: t("admin.overview.metrics.totalHotelAccounts"), value: stats?.hotelUsers ?? 0 },
      ],
    },
    {
      title: t("admin.overview.sections.subscriptions"),
      tint: "text-primary bg-primary/10",
      icon: CreditCard,
      cards: [
        { label: t("admin.overview.metrics.activeSubscriptions"), value: stats?.subActive ?? 0 },
        {
          label: t("admin.overview.metrics.pendingSubscriptionRequests"),
          value: stats?.subWaiting ?? 0,
        },
      ],
    },
  ];

  const tasks = [
    {
      id: "pending-hotels",
      title: t("dashboard.tasks.admin.hotels"),
      description: t("dashboard.tasks.admin.hotelsDescription"),
      count: stats?.companiesPending ?? 0,
      to: "/admin/hotel-companies",
      icon: Building2,
      tone: "warning" as const,
    },
    {
      id: "pending-listings",
      title: t("dashboard.tasks.admin.listings"),
      description: t("dashboard.tasks.admin.listingsDescription"),
      count: stats?.listingsPending ?? 0,
      to: "/admin/hotel-listings",
      icon: Hotel,
      tone: "info" as const,
    },
    {
      id: "agency-verification",
      title: t("dashboard.tasks.admin.agencies"),
      description: t("dashboard.tasks.admin.agenciesDescription"),
      count: stats?.agenciesPending ?? 0,
      to: "/admin/agency-verifications",
      icon: BadgeCheck,
      tone: "success" as const,
    },
    {
      id: "subscriptions",
      title: t("dashboard.tasks.admin.subscriptions"),
      description: t("dashboard.tasks.admin.subscriptionsDescription"),
      count: stats?.subWaiting ?? 0,
      to: "/admin/subscription-interest",
      icon: CreditCard,
      tone: "primary" as const,
    },
  ];

  const quickActions = [
    {
      id: "hotels",
      label: t("admin.hotelCompanies.title"),
      description: t("admin.overview.actions.hotelCompanies"),
      to: "/admin/hotel-companies",
      icon: Building2,
    },
    {
      id: "listings",
      label: t("admin.hotelListings.title"),
      description: t("admin.overview.actions.hotelListings"),
      to: "/admin/hotel-listings",
      icon: Hotel,
    },
    {
      id: "agencies",
      label: t("admin.agencyVerifications.title"),
      description: t("admin.overview.actions.agencyVerifications"),
      to: "/admin/agency-verifications",
      icon: BadgeCheck,
    },
    {
      id: "rfqs",
      label: t("nav.groupRequests"),
      description: t("admin.overview.actions.groupRequests"),
      to: "/admin/group-requests",
      icon: FileText,
    },
    {
      id: "users",
      label: t("nav.users"),
      description: t("admin.overview.actions.users"),
      to: "/admin/users",
      icon: Users,
    },
    {
      id: "interest",
      label: t("nav.subscriptionInterest"),
      description: t("admin.overview.actions.subscriptionInterest"),
      to: "/admin/subscription-interest",
      icon: Inbox,
    },
    {
      id: "settings",
      label: t("nav.settings"),
      description: t("admin.overview.actions.settings"),
      to: "/admin/settings",
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow={t("admin.overview.console")}
        title={t("admin.overview.title")}
        description={t("admin.overview.description")}
        icon={ShieldCheck}
      />

      <div className="space-y-8">
        {sections.map((sec) => (
          <WorkspaceSection key={sec.title} title={sec.title}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {sec.cards.map((c) => (
                <div
                  key={c.label}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm"
                >
                  <div className={`inline-grid h-9 w-9 place-items-center rounded-md ${sec.tint}`}>
                    <sec.icon className="h-4 w-4" />
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-foreground tabular-nums">
                    {c.value}
                  </div>
                  <div className="mt-1 text-xs font-medium text-muted-foreground">{c.label}</div>
                </div>
              ))}
            </div>
          </WorkspaceSection>
        ))}
      </div>

      <WorkspaceSection
        title={t("dashboard.tasks.title")}
        description={t("dashboard.tasks.description")}
      >
        <TaskGrid tasks={tasks} />
      </WorkspaceSection>

      <WorkspaceSection title={t("admin.overview.quickActions")}>
        <QuickActions actions={quickActions} />
      </WorkspaceSection>

      <RecentActivity />
    </section>
  );
}

function RecentActivity() {
  const { t } = useTranslation();
  const { data: activity = [] } = useQuery({
    queryKey: ["admin-recent-activity"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [hotels, interest] = await Promise.all([
        supabase
          .from("hotels")
          .select("id, name, status, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("subscription_interest")
          .select("id, full_name, hotel_name, requested_plan, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      type Item = { key: string; when: string; icon: any; tint: string; text: string };
      const items: Item[] = [];
      (hotels.data ?? []).forEach((h: any) => {
        const isApproved = h.status === "approved";
        const isSuspended = h.status === "suspended";
        items.push({
          key: `h-${h.id}`,
          when: h.created_at,
          icon: isApproved ? CheckCircle2 : isSuspended ? XCircle : Clock,
          tint: isApproved
            ? "text-success bg-success/10"
            : isSuspended
              ? "text-error bg-error/10"
              : "text-muted-foreground bg-muted",
          text: isApproved
            ? i18n.t("admin.overview.activity.hotelApproved", { name: h.name })
            : isSuspended
              ? i18n.t("admin.overview.activity.hotelRejected", { name: h.name })
              : i18n.t("admin.overview.activity.newListing", { name: h.name }),
        });
      });
      (interest.data ?? []).forEach((r: any) => {
        items.push({
          key: `i-${r.id}`,
          when: r.created_at,
          icon: CreditCard,
          tint: "text-premium bg-premium/15",
          text: i18n.t("admin.overview.activity.subscriptionRequest", {
            plan: r.requested_plan,
            name: r.hotel_name ?? r.full_name,
          }),
        });
      });
      return items
        .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
        .slice(0, 10);
    },
  });

  return (
    <WorkspaceSection title={t("admin.overview.recentActivity")}>
      <Card>
        <CardContent className="p-0">
          {activity.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {t("admin.overview.noRecentActivity")}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((a) => (
                <li key={a.key} className="flex items-center gap-3 p-4">
                  <span className={`grid h-9 w-9 place-items-center rounded-md ${a.tint}`}>
                    <a.icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{a.text}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.when), { addSuffix: true })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </WorkspaceSection>
  );
}
