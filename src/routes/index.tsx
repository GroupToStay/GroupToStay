import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PublicSiteHeader } from "@/components/public-site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Building2,
  Users,
  Globe2,
  Clock,
  ClipboardList,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Star,
  MessageSquare,
  Inbox,
  Hotel,
  Calendar,
  BedDouble,
  MapPin,
  Sparkles,
  Handshake,
  BadgeCheck,
  TimerReset,
  Lock,
  Quote as QuoteIcon,
  ArrowUpRight,
} from "lucide-react";
import { RfqSharedFields, type RfqSharedValues } from "@/features/rfq/RfqSharedFields";
import { sharedValuesToSearch } from "@/features/rfq/rfq-search-params";
import heroImage from "@/assets/hero-lobby.jpg";
import { formatDistanceToNow } from "date-fns";
import { useApplicationLocale } from "@/lib/application-locale";
import { fetchPublicCount, fetchPublicRows } from "@/integrations/supabase/public-rest";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import i18n from "@/lib/i18n";

const heroImg = heroImage.src;
const heroAvifSrcSet = heroImage.src;
const heroWebpSrcSet = heroImage.src;
const heroJpgSrcSet = heroImage.src;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: i18n.t("landing.meta.title") },
      {
        name: "description",
        content: i18n.t("landing.meta.description"),
      },
      { property: "og:title", content: i18n.t("landing.meta.title") },
      {
        property: "og:description",
        content: i18n.t("landing.meta.ogDescription"),
      },
      { property: "og:url", content: "https://groupstay-connect.lovable.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://groupstay-connect.lovable.app/" },
      {
        rel: "preload",
        as: "image",
        href: heroImg,
        imageSrcSet: heroAvifSrcSet,
        imageSizes: "100vw",
        type: "image/avif",
        fetchPriority: "high",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: i18n.t("landing.schema.name"),
          serviceType: i18n.t("landing.schema.serviceType"),
          provider: { "@type": "Organization", name: "GroupToStay" },
          areaServed: i18n.t("landing.schema.areaServed"),
          description: i18n.t("landing.schema.description"),
          url: "https://groupstay-connect.lovable.app/",
        }),
      },
    ],
  }),
  component: Landing,
});

function useLandingSession() {
  const { user, session, loading: authLoading } = useAuth();
  const { isAdmin, isHotel, isOrganizer, loading: rolesLoading } = useRoles();

  return {
    user,
    accessToken: session?.access_token,
    isAdmin,
    isHotel,
    isOrganizer,
    rolesLoading: authLoading || (!!user && rolesLoading),
  };
}

function Landing() {
  const { t } = useTranslation();
  const { user, accessToken, isHotel, isAdmin, isOrganizer, rolesLoading } = useLandingSession();

  if (user && rolesLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <PublicSiteHeader />
        <div className="container-page py-20 text-center text-muted-foreground">
          {t("common.loading")}
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (user && isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <PublicSiteHeader />
        <AdminExecutiveDashboard accessToken={accessToken} />
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <PublicSiteHeader />
      {user ? (
        <WelcomeBanner
          userId={user.id}
          accessToken={accessToken}
          isHotel={isHotel}
          isAdmin={isAdmin}
          isOrganizer={isOrganizer}
        />
      ) : null}
      <Hero isHotel={isHotel} isOrganizer={isOrganizer} isVisitor={!user} />
      <QuickSearchPanel isHotel={isHotel} />
      <HowItWorks />
      {isHotel ? <OpenRequestsSection accessToken={accessToken} /> : null}
      {isAdmin ? <FeaturedHotelsSection accessToken={accessToken} /> : null}
      <WhyGroupToStay />
      <TrustSection />
      {user ? <MessagesBar userId={user.id} accessToken={accessToken} /> : null}
      <CtaBanner isHotel={isHotel} isOrganizer={isOrganizer} />
      <SiteFooter />
    </div>
  );
}

/* ────────────────────────────  WELCOME BANNER  ──────────────────────────── */

function WelcomeBanner({
  userId,
  accessToken,
  isHotel,
  isAdmin,
  isOrganizer,
}: {
  userId: string;
  accessToken?: string;
  isHotel: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
}) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["welcome-banner", userId, isHotel],
    enabled: !!accessToken,
    queryFn: async () => {
      const [profileRows, hotelRows] = await Promise.all([
        fetchPublicRows<{ full_name: string | null; company_name: string | null }>(
          "profiles",
          {
            select: "full_name,company_name",
            id: `eq.${userId}`,
            limit: 1,
          },
          { accessToken },
        ),
        isHotel
          ? fetchPublicRows<{ name: string | null }>(
              "hotels",
              {
                select: "name",
                owner_id: `eq.${userId}`,
                limit: 1,
              },
              { accessToken },
            )
          : Promise.resolve([] as { name: string | null }[]),
      ]);
      const profile = profileRows[0];
      return {
        name: profile?.company_name || profile?.full_name || "",
        hotelName: hotelRows[0]?.name || "",
      };
    },
  });

  let title = t("landing.welcome.default");
  let actions: { label: string; to: string; icon: any; search?: any }[] = [];
  let badgeText = "";

  if (isAdmin) {
    title = t("landing.welcome.adminTitle");
    badgeText = t("role.admin");
    actions = [
      { label: t("landing.welcome.actions.viewDashboard"), to: "/admin", icon: ClipboardList },
      {
        label: t("landing.welcome.actions.reviewHotels"),
        to: "/admin/hotel-companies",
        icon: Hotel,
      },
      {
        label: t("landing.welcome.actions.reviewListings"),
        to: "/admin/hotel-listings",
        icon: Building2,
      },
      {
        label: t("landing.welcome.actions.subscriptionRequests"),
        to: "/admin/subscription-interest",
        icon: Inbox,
      },
    ];
  } else if (isHotel) {
    title = t("landing.welcome.namedTitle", {
      name: data?.hotelName || data?.name || t("role.hotel"),
    });
    badgeText = t("role.hotel");
    actions = [
      {
        label: t("landing.welcome.actions.viewOpenRequests"),
        to: "/requests",
        icon: ClipboardList,
      },
      { label: t("nav.myQuotations"), to: "/dashboard/quotations", icon: FileText },
      { label: t("nav.manageHotelProfile"), to: "/dashboard/hotel", icon: Hotel },
    ];
  } else if (isOrganizer) {
    title = t("landing.welcome.namedTitle", { name: data?.name || t("role.agency") });
    badgeText = t("role.agency");
    actions = [
      { label: t("nav.createRequestShort"), to: "/request-quote", icon: ClipboardList },
      { label: t("nav.myRequests"), to: "/dashboard/rfqs", icon: FileText },
      { label: t("nav.receivedOffers"), to: "/dashboard/quotations", icon: Inbox },
    ];
  } else {
    return null;
  }

  return (
    <section className="bg-gradient-to-r from-primary to-[oklch(0.32_0.10_264)] text-primary-foreground border-b border-border/40">
      <div className="container-page py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Badge className="bg-premium text-premium-foreground border-0 uppercase tracking-wider shrink-0">
            {badgeText}
          </Badge>
          <h2 className="font-display text-xl md:text-2xl font-semibold truncate">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.label}
              asChild
              size="sm"
              variant="outline"
              className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to={a.to}>
                <a.icon className="h-4 w-4" /> {a.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────  ADMIN EXECUTIVE DASHBOARD  ──────────────────────────── */

function AdminExecutiveDashboard({ accessToken }: { accessToken?: string }) {
  const { t, i18n: activeI18n } = useTranslation();
  const { data: stats } = useQuery({
    queryKey: ["admin-exec-stats"],
    enabled: !!accessToken,
    refetchInterval: 60_000,
    queryFn: async () => {
      const count = (table: string, params: Record<string, string | number | boolean>) =>
        fetchPublicCount(table, { select: "id", ...params }, { accessToken });
      const counts = await Promise.all([
        count("profiles", { hotel_approval_status: "not.is.null" }),
        count("hotels", { status: "eq.approved" }),
        count("hotels", { status: "eq.pending" }),
        count("profiles", { hotel_approval_status: "eq.rejected" }),
        count("user_roles", { role: "eq.organizer" }),
        count("rfqs", { status: "eq.open" }),
        count("quotes", {}),
        count("bookings", { status: "eq.confirmed" }),
        count("subscription_interest", {}),
        count("profiles", {}),
        count("profiles", { pms_enabled: "eq.true" }),
        count("profiles", { pms_enabled: "eq.false" }),
      ]);
      const startMonth = new Date();
      startMonth.setDate(1);
      startMonth.setHours(0, 0, 0, 0);
      const [agenciesMonth, rfqsMonth, quotesAvg] = await Promise.all([
        fetchPublicCount(
          "rfqs",
          { select: "organizer_id", created_at: `gte.${startMonth.toISOString()}` },
          { accessToken },
        ),
        count("rfqs", { created_at: `gte.${startMonth.toISOString()}` }),
        fetchPublicRows<{ rfq_id: string }>("quotes", { select: "rfq_id" }, { accessToken }),
      ]);
      const quoteRows = quotesAvg;
      const byRfq = new Map<string, number>();
      quoteRows.forEach((q) => byRfq.set(q.rfq_id, (byRfq.get(q.rfq_id) ?? 0) + 1));
      const avgQuotes = byRfq.size
        ? Array.from(byRfq.values()).reduce((a, b) => a + b, 0) / byRfq.size
        : 0;
      return {
        companies: counts[0],
        hotelsApproved: counts[1],
        hotelsPending: counts[2],
        hotelsRejected: counts[3],
        agencies: counts[4],
        openRfqs: counts[5],
        quotes: counts[6],
        confirmedDeals: counts[7],
        subInterest: counts[8],
        users: counts[9],
        pmsEnabled: counts[10],
        pmsDisabled: counts[11],
        agenciesMonth,
        rfqsMonth,
        avgQuotes,
      };
    },
  });

  const { data: activity } = useQuery({
    queryKey: ["admin-exec-activity", activeI18n.language],
    enabled: !!accessToken,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [hotels, agencies, rfqs, quotes, subs] = await Promise.all([
        fetchPublicRows<{
          id: string;
          name: string | null;
          status: string | null;
          created_at: string;
        }>(
          "hotels",
          { select: "id,name,status,created_at", order: "created_at.desc", limit: 6 },
          { accessToken },
        ),
        fetchPublicRows<{
          id: string;
          full_name: string | null;
          company_name: string | null;
          created_at: string;
        }>(
          "profiles",
          { select: "id,full_name,company_name,created_at", order: "created_at.desc", limit: 6 },
          { accessToken },
        ),
        fetchPublicRows<{ id: string; title: string | null; created_at: string }>(
          "rfqs",
          { select: "id,title,created_at", order: "created_at.desc", limit: 6 },
          { accessToken },
        ),
        fetchPublicRows<{ id: string; created_at: string; hotel_id: string | null }>(
          "quotes",
          { select: "id,created_at,hotel_id", order: "created_at.desc", limit: 6 },
          { accessToken },
        ),
        fetchPublicRows<{ id: string; full_name: string | null; created_at: string }>(
          "subscription_interest",
          { select: "id,full_name,created_at", order: "created_at.desc", limit: 6 },
          { accessToken },
        ),
      ]);
      type Item = { ts: string; label: string; sub?: string; status?: string };
      const items: Item[] = [];
      hotels.forEach((h) =>
        items.push({
          ts: h.created_at,
          label: t("admin.overview.activity.hotelListing", { name: h.name }),
          status: h.status ?? undefined,
        }),
      );
      agencies.forEach((p) =>
        items.push({
          ts: p.created_at,
          label: t("admin.overview.activity.newRegistration", {
            name: p.company_name || p.full_name || t("admin.overview.activity.fallbackUser"),
          }),
        }),
      );
      rfqs.forEach((r) =>
        items.push({
          ts: r.created_at,
          label: t("admin.overview.activity.newGroupRequest", { title: r.title }),
        }),
      );
      quotes.forEach((q) =>
        items.push({ ts: q.created_at, label: t("admin.overview.activity.newQuotationSubmitted") }),
      );
      subs.forEach((s) =>
        items.push({
          ts: s.created_at,
          label: t("admin.overview.activity.subscriptionInterest", {
            name: s.full_name || t("admin.overview.activity.fallbackLead"),
          }),
        }),
      );
      return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 12);
    },
  });

  const kpis = [
    {
      label: t("admin.overview.metrics.totalHotelCompanies"),
      value: stats?.companies ?? 0,
      icon: Building2,
      to: "/admin/hotel-companies",
    },
    {
      label: t("admin.overview.metrics.approvedHotels"),
      value: stats?.hotelsApproved ?? 0,
      icon: CheckCircle2,
      to: "/admin/hotel-listings",
    },
    {
      label: t("admin.overview.metrics.pendingHotelReviews"),
      value: stats?.hotelsPending ?? 0,
      icon: Clock,
      to: "/admin/hotel-listings",
    },
    {
      label: t("admin.overview.metrics.rejectedHotels"),
      value: stats?.hotelsRejected ?? 0,
      icon: ShieldCheck,
      to: "/admin/hotel-listings",
    },
    {
      label: t("admin.overview.metrics.activeAgencyAccounts"),
      value: stats?.agencies ?? 0,
      icon: Users,
      to: "/admin/users",
    },
    {
      label: t("admin.overview.metrics.openGroupRequests"),
      value: stats?.openRfqs ?? 0,
      icon: ClipboardList,
      to: "/admin/group-requests",
    },
    {
      label: t("admin.overview.metrics.submittedQuotations"),
      value: stats?.quotes ?? 0,
      icon: FileText,
      to: "/admin",
    },
    {
      label: t("admin.overview.metrics.confirmedDeals"),
      value: stats?.confirmedDeals ?? 0,
      icon: Handshake,
      to: "/admin",
    },
    {
      label: t("admin.overview.metrics.subscriptionInterestLeads"),
      value: stats?.subInterest ?? 0,
      icon: Inbox,
      to: "/admin/subscription-interest",
    },
    {
      label: t("admin.overview.metrics.totalPlatformUsers"),
      value: stats?.users ?? 0,
      icon: Globe2,
      to: "/admin/users",
    },
  ];

  const quickActions = [
    {
      label: t("admin.overview.actions.reviewHotelCompanies"),
      to: "/admin/hotel-companies",
      icon: Building2,
    },
    {
      label: t("admin.overview.actions.reviewHotelListings"),
      to: "/admin/hotel-listings",
      icon: Hotel,
    },
    {
      label: t("admin.overview.actions.reviewSubscriptionInterest"),
      to: "/admin/subscription-interest",
      icon: Inbox,
    },
    { label: t("admin.overview.actions.viewAllUsers"), to: "/admin/users", icon: Users },
    {
      label: t("admin.overview.actions.viewGroupRequests"),
      to: "/admin/group-requests",
      icon: ClipboardList,
    },
    {
      label: t("admin.overview.actions.platformSettings"),
      to: "/settings",
      icon: ShieldCheck,
    },
  ];

  const pending = [
    {
      label: t("admin.overview.attention.hotelsAwaitingApproval"),
      value: stats?.hotelsPending ?? 0,
      to: "/admin/hotel-listings",
      cta: t("admin.overview.actions.review"),
    },
    {
      label: t("admin.overview.attention.companiesAwaitingVerification"),
      value: stats?.companies ?? 0,
      to: "/admin/hotel-companies",
      cta: t("admin.overview.actions.open"),
    },
    {
      label: t("admin.overview.attention.subscriptionInterestLeads"),
      value: stats?.subInterest ?? 0,
      to: "/admin/subscription-interest",
      cta: t("admin.overview.actions.view"),
    },
  ];

  const health = [
    { label: t("admin.overview.health.activeHotels"), value: stats?.hotelsApproved ?? 0 },
    { label: t("admin.overview.health.hotelsWithPms"), value: stats?.pmsEnabled ?? 0 },
    { label: t("admin.overview.health.hotelsWithoutPms"), value: stats?.pmsDisabled ?? 0 },
    { label: t("admin.overview.health.agenciesActiveThisMonth"), value: stats?.agenciesMonth ?? 0 },
    { label: t("admin.overview.health.openRequestsThisMonth"), value: stats?.rfqsMonth ?? 0 },
    {
      label: t("admin.overview.health.avgQuotationsPerRequest"),
      value: (stats?.avgQuotes ?? 0).toFixed(1),
    },
  ];

  return (
    <main className="flex-1">
      <section className="container-page py-10 md:py-14">
        <div className="rounded-2xl bg-gradient-to-br from-[oklch(0.18_0.04_265)] to-[oklch(0.32_0.10_264)] text-primary-foreground p-8 md:p-10">
          <Badge className="bg-premium text-premium-foreground border-0 mb-3 uppercase tracking-wider">
            {t("admin.overview.console")}
          </Badge>
          <h1 className="font-display text-3xl md:text-4xl font-semibold">
            {t("admin.overview.title")}
          </h1>
          <p className="mt-2 text-primary-foreground/80 max-w-2xl">
            {t("admin.overview.description")}
          </p>
        </div>

        {/* KPI grid */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpis.map((k) => (
            <Link
              key={k.label}
              to={k.to}
              className="rounded-2xl bg-card border border-border p-5 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] transition"
            >
              <span className="inline-grid h-9 w-9 place-items-center rounded-lg bg-brand-blue/10 text-brand-blue">
                <k.icon className="h-4 w-4" />
              </span>
              <div className="mt-3 font-display text-3xl font-semibold text-primary">{k.value}</div>
              <div className="mt-0.5 text-sm text-muted-foreground">{k.label}</div>
            </Link>
          ))}
        </div>

        {/* Activity + Pending */}
        <div className="mt-10 grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <h2 className="font-display text-xl text-primary mb-4">
                {t("admin.overview.recentActivity")}
              </h2>
              {!activity?.length ? (
                <div className="text-sm text-muted-foreground">
                  {t("admin.overview.noRecentActivity")}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {activity.map((a, i) => (
                    <li key={i} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-foreground truncate">{a.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(a.ts), { addSuffix: true })}
                        </div>
                      </div>
                      {a.status && (
                        <Badge variant="secondary" className="capitalize shrink-0">
                          {t(`status.${a.status}`, { defaultValue: a.status })}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="font-display text-xl text-primary mb-4">
                {t("admin.overview.requiresAttention")}
              </h2>
              <ul className="space-y-3">
                {pending.map((p) => (
                  <li
                    key={p.label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{p.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("admin.overview.itemCount", { count: p.value })}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to={p.to}>{p.cta}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-10">
          <h2 className="font-display text-xl text-primary mb-3">
            {t("admin.overview.quickActions")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((qa) => (
              <Link key={qa.label} to={qa.to}>
                <Card className="h-full hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] transition">
                  <CardContent className="p-5 flex items-center gap-4">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-blue/10 text-brand-blue">
                      <qa.icon className="h-5 w-5" />
                    </span>
                    <div className="flex-1 font-display text-base text-primary">{qa.label}</div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Platform Health */}
        <div className="mt-10">
          <h2 className="font-display text-xl text-primary mb-3">
            {t("admin.overview.platformHealth")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {health.map((h) => (
              <div key={h.label} className="rounded-2xl bg-card border border-border p-5">
                <div className="font-display text-2xl font-semibold text-primary">{h.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{h.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function AdminLanding({ accessToken }: { accessToken?: string }) {
  const { t } = useTranslation();
  const { data: stats } = useQuery({
    queryKey: ["admin-landing-stats"],
    enabled: !!accessToken,
    refetchInterval: 60_000,
    queryFn: async () => {
      const count = (table: string, params: Record<string, string | number | boolean>) =>
        fetchPublicCount(table, { select: "id", ...params }, { accessToken });
      const [
        companiesTotal,
        companiesApproved,
        companiesPending,
        companiesRejected,
        rfqsTotal,
        rfqsOpen,
        rfqsClosed,
        rolesAgency,
        rolesHotel,
        subActive,
        subWaiting,
      ] = await Promise.all([
        count("profiles", { hotel_approval_status: "not.is.null" }),
        count("profiles", { hotel_approval_status: "eq.approved" }),
        count("profiles", { hotel_approval_status: "eq.pending" }),
        count("profiles", { hotel_approval_status: "eq.rejected" }),
        count("rfqs", {}),
        count("rfqs", { status: "eq.open" }),
        count("rfqs", { status: "in.(closed,awarded,cancelled)" }),
        count("user_roles", { role: "eq.organizer" }),
        count("user_roles", { role: "eq.hotel" }),
        count("subscription_interest", { status: "eq.notified" }),
        count("subscription_interest", { status: "eq.waiting" }),
      ]);
      return {
        companiesTotal,
        companiesApproved,
        companiesPending,
        companiesRejected,
        rfqsTotal,
        rfqsOpen,
        rfqsClosed,
        agencies: rolesAgency,
        hotelUsers: rolesHotel,
        subActive,
        subWaiting,
      };
    },
  });

  const sections: {
    title: string;
    tint: string;
    cards: { label: string; value: number | string }[];
  }[] = [
    {
      title: t("admin.overview.sections.hotels"),
      tint: "text-brand-blue bg-brand-blue/10",
      cards: [
        {
          label: t("admin.overview.metrics.totalHotelCompanies"),
          value: stats?.companiesTotal ?? 0,
        },
        { label: t("status.approved"), value: stats?.companiesApproved ?? 0 },
        { label: t("status.pending"), value: stats?.companiesPending ?? 0 },
        { label: t("status.rejected"), value: stats?.companiesRejected ?? 0 },
      ],
    },
    {
      title: t("admin.overview.sections.requests"),
      tint: "text-premium bg-premium/15",
      cards: [
        { label: t("admin.overview.metrics.totalRequests"), value: stats?.rfqsTotal ?? 0 },
        { label: t("admin.overview.metrics.activeOpen"), value: stats?.rfqsOpen ?? 0 },
        { label: t("status.closed"), value: stats?.rfqsClosed ?? 0 },
      ],
    },
    {
      title: t("admin.overview.sections.users"),
      tint: "text-success bg-success/10",
      cards: [
        { label: t("admin.overview.metrics.totalAgencies"), value: stats?.agencies ?? 0 },
        { label: t("admin.overview.metrics.totalHotelUsers"), value: stats?.hotelUsers ?? 0 },
      ],
    },
    {
      title: t("admin.overview.sections.revenue"),
      tint: "text-primary bg-primary/10",
      cards: [
        { label: t("admin.overview.metrics.activeSubscriptions"), value: stats?.subActive ?? 0 },
        {
          label: t("admin.overview.metrics.pendingSubscriptionRequests"),
          value: stats?.subWaiting ?? 0,
        },
      ],
    },
  ];

  const quickActions = [
    {
      title: t("admin.overview.actions.hotelCompaniesTitle"),
      desc: t("admin.overview.actions.hotelCompanies"),
      to: "/admin/hotel-companies",
      search: undefined,
      icon: Building2,
      badge: null as string | null,
    },
    {
      title: t("admin.overview.actions.hotelListingsTitle"),
      desc: t("admin.overview.actions.hotelListings"),
      to: "/admin/hotel-listings",
      search: undefined,
      icon: Hotel,
      badge: null,
    },
    {
      title: t("admin.overview.actions.groupRequestsTitle"),
      desc: t("admin.overview.actions.groupRequests"),
      to: "/admin/group-requests",
      search: undefined,
      icon: FileText,
      badge: null,
    },
    {
      title: t("admin.overview.actions.usersTitle"),
      desc: t("admin.overview.actions.users"),
      to: "/admin/users",
      search: undefined,
      icon: Users,
      badge: null,
    },
    {
      title: t("admin.overview.actions.subscriptionInterestTitle"),
      desc: t("admin.overview.actions.subscriptionInterest"),
      to: "/admin/subscription-interest",
      search: undefined,
      icon: Inbox,
      badge: null,
    },
    {
      title: t("admin.overview.actions.subscriptionsTitle"),
      desc: t("admin.overview.actions.subscriptions"),
      to: "/admin/subscriptions",
      search: undefined,
      icon: BadgeCheck,
      badge: t("admin.overview.notActiveYet"),
    },
    {
      title: t("admin.overview.actions.settingsTitle"),
      desc: t("admin.overview.actions.settings"),
      to: "/settings",
      search: undefined,
      icon: ShieldCheck,
      badge: null,
    },
  ];

  return (
    <section className="container-page py-10 md:py-14">
      <div className="rounded-2xl bg-gradient-to-br from-[oklch(0.18_0.04_265)] to-[oklch(0.32_0.10_264)] text-primary-foreground p-8 md:p-10">
        <Badge className="bg-premium text-premium-foreground border-0 mb-3 uppercase tracking-wider">
          {t("admin.overview.console")}
        </Badge>
        <h1 className="font-display text-3xl md:text-4xl font-semibold">
          {t("admin.overview.welcomeAdmin")}
        </h1>
        <p className="mt-2 text-primary-foreground/80 max-w-2xl">
          {t("admin.overview.legacyDescription")}
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {sections.map((sec) => (
          <div key={sec.title}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-display text-xl text-primary">{sec.title}</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {sec.cards.map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl bg-card border border-border p-5 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] transition"
                >
                  <div className={`inline-grid h-9 w-9 place-items-center rounded-lg ${sec.tint}`}>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="mt-3 font-display text-3xl font-semibold text-primary">
                    {c.value}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="font-display text-xl text-primary mb-3">
          {t("admin.overview.quickActions")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((qa) => {
            const Inner = (
              <Card className="h-full hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] transition">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-blue/10 text-brand-blue">
                      <qa.icon className="h-5 w-5" />
                    </span>
                    {qa.badge ? (
                      <Badge className="bg-muted text-muted-foreground">{qa.badge}</Badge>
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="mt-3 font-display text-lg text-primary">{qa.title}</div>
                  <div className="text-sm text-muted-foreground">{qa.desc}</div>
                </CardContent>
              </Card>
            );
            return qa.badge ? (
              <div key={qa.title} className="opacity-70 cursor-not-allowed">
                {Inner}
              </div>
            ) : qa.search ? (
              <Link key={qa.title} to={qa.to} search={qa.search as any}>
                {Inner}
              </Link>
            ) : (
              <Link key={qa.title} to={qa.to}>
                {Inner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────  HERO  ──────────────────────────────── */

function Hero({
  isHotel,
  isOrganizer,
  isVisitor,
}: {
  isHotel: boolean;
  isOrganizer?: boolean;
  isVisitor: boolean;
}) {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden">
      <picture>
        <source type="image/avif" srcSet={heroAvifSrcSet} sizes="100vw" />
        <source type="image/webp" srcSet={heroWebpSrcSet} sizes="100vw" />
        <img
          src={heroImg}
          srcSet={heroJpgSrcSet}
          sizes="100vw"
          alt=""
          width={1920}
          height={1280}
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>
      <div className="absolute inset-0 bg-primary/80" />
      <div
        className={`relative container-page ${
          isVisitor ? "py-10 md:py-12 lg:py-14" : "py-12 md:py-16"
        }`}
      >
        <div className="mx-auto max-w-4xl text-center">
          <div className="text-primary-foreground">
            <Badge className="mb-4 max-w-full justify-center whitespace-normal border-gold/30 bg-gold text-center text-[10px] leading-tight text-gold-foreground sm:text-xs">
              {t("hero.eyebrow")}
            </Badge>
            <h1
              className={`font-display font-semibold leading-[1.05] ${
                isVisitor
                  ? "text-2xl sm:text-3xl md:text-4xl lg:text-5xl"
                  : "text-4xl md:text-5xl lg:text-6xl"
              }`}
            >
              {t("landing.hero.titleLine1")} <br />
              <span className="text-premium">{t("landing.hero.titleLine2")}</span>
            </h1>
            <p
              className={`mt-4 text-sm text-primary-foreground/85 sm:text-base md:text-lg ${
                isVisitor ? "mx-auto max-w-2xl" : "max-w-xl"
              }`}
            >
              {t("landing.hero.subtitle")}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {isHotel ? (
                <>
                  <Button asChild size="lg" variant="hero">
                    <Link to="/requests">
                      {t("landing.actions.browseOpenRequests")}{" "}
                      <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    <Link to="/dashboard/hotel">{t("nav.manageHotelProfile")}</Link>
                  </Button>
                </>
              ) : isOrganizer ? (
                <>
                  <Button asChild size="lg" variant="hero">
                    <Link to="/request-quote">
                      {t("nav.createRequestShort")}{" "}
                      <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    <Link to="/dashboard/rfqs">{t("landing.actions.viewMyRequests")}</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    asChild
                    size="lg"
                    variant="hero"
                    className={isVisitor ? "w-full sm:w-auto" : ""}
                  >
                    <Link to="/request-quote">
                      {t("nav.createRequest")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className={`bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground ${
                      isVisitor ? "w-full sm:w-auto" : ""
                    }`}
                  >
                    <Link to="/how-it-works">{t("nav.howItWorks")}</Link>
                  </Button>
                </>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-primary-foreground/75">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-gold" /> {t("hero.trustPillHotels")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <TimerReset className="h-4 w-4 text-gold" /> {t("hero.trustPillQuotes")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-gold" /> {t("hero.trustPillSecure")}
              </span>
            </div>
          </div>

          {/* RIGHT — live stat cards */}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────  QUICK SEARCH PANEL  ──────────────────── */

function QuickSearchPanel({ isHotel }: { isHotel: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [values, setValues] = useState<RfqSharedValues>({
    destination_country_id: null,
    destination_city_id: null,
    guests_count: null,
    rooms_needed: null,
    check_in: "",
    check_out: "",
    hotel_categories_v2: [],
    accommodation_type: "any",
    meal_plan_code: "bb",
    requirements: "",
  });
  if (isHotel) return null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/request-quote", search: sharedValuesToSearch(values) as any });
  };

  return (
    <section className="container-page relative z-10 -mt-5 md:-mt-8">
      <form
        method="post"
        onSubmit={onSubmit}
        className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-elevated)] md:p-7"
      >
        <div className="mb-5 flex flex-wrap items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-gold shadow-sm">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="min-w-0 flex-1 whitespace-normal break-words text-lg font-semibold leading-tight text-foreground sm:text-xl md:text-2xl">
            {t("landing.quickRequest.title")}
          </h2>
          <span className="hidden basis-full text-xs text-muted-foreground md:block md:ps-11 lg:ms-auto lg:basis-auto lg:ps-0">
            {t("landing.quickRequest.note")}
          </span>
        </div>

        <RfqSharedFields
          variant="compact"
          value={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          requirementsHint={t("landing.quickRequest.requirementsHint")}
        />

        <div className="mt-5 flex justify-end">
          <Button type="submit" size="lg" className="w-full sm:w-auto">
            {t("landing.quickRequest.submit")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </form>
    </section>
  );
}

/* ────────────────────  LIVE MARKETPLACE  ──────────────────── */

/* ────────────────────  HOW IT WORKS  ──────────────────── */

function HowItWorks() {
  const { t } = useTranslation();
  const steps = [
    {
      icon: ClipboardList,
      title: t("landing.how.steps.create.title"),
      desc: t("landing.how.steps.create.description"),
    },
    {
      icon: Hotel,
      title: t("landing.how.steps.invitations.title"),
      desc: t("landing.how.steps.invitations.description"),
    },
    {
      icon: FileText,
      title: t("landing.how.steps.quotations.title"),
      desc: t("landing.how.steps.quotations.description"),
    },
    {
      icon: CheckCircle2,
      title: t("landing.how.steps.choose.title"),
      desc: t("landing.how.steps.choose.description"),
    },
  ];
  return (
    <section className="border-y border-border bg-background">
      <div className="container-page py-16 md:py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl md:text-4xl text-primary">
            {t("landing.how.title")}
          </h2>
          <p className="mt-2 text-muted-foreground">{t("landing.how.subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 border-y border-border md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative border-b border-border p-6 last:border-b-0 md:[&:nth-child(odd)]:border-e md:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:border-e lg:last:border-e-0"
            >
              <div className="absolute end-5 top-5 text-4xl font-semibold leading-none text-primary/10">
                {String(i + 1).padStart(2, "0")}
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-md bg-primary text-gold">
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-base font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────  OPEN REQUESTS  ──────────────────── */

function OpenRequestsSection({ accessToken }: { accessToken?: string }) {
  const { t } = useTranslation();
  const { formatDate } = useApplicationLocale();
  const { data: rfqs = [] } = useQuery({
    queryKey: ["home-open-requests"],
    enabled: !!accessToken,
    queryFn: async () => {
      return fetchPublicRows<any>(
        "rfqs",
        {
          select:
            "id,title,group_type,destination_city,destination_country,check_in,check_out,nights,guests_count,rooms_needed,created_at",
          status: "eq.open",
          order: "created_at.desc",
          limit: 6,
        },
        { accessToken },
      );
    },
  });

  if (rfqs.length === 0) return null;

  return (
    <section className="container-page py-16 md:py-20">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h2 className="font-display text-3xl md:text-4xl text-primary">
            {t("landing.openRequests.title")}
          </h2>
          <p className="mt-2 text-muted-foreground">{t("landing.openRequests.subtitle")}</p>
        </div>
        <Button asChild variant="ghost">
          <Link to="/requests">
            {t("buttons.viewAll")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rfqs.map((r: any) => (
          <Card
            key={r.id}
            className="group h-full border-border hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] transition overflow-hidden"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <Badge className="bg-success/15 text-success border-0 uppercase tracking-wide text-[10px]">
                  {r.group_type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {r.created_at ? formatDate(r.created_at) : ""}
                </span>
              </div>
              <h3 className="font-display text-lg text-primary font-semibold line-clamp-2 min-h-[3.25rem]">
                {r.title}
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Meta icon={MapPin}>
                  {r.destination_city}, {r.destination_country}
                </Meta>
                <Meta icon={Calendar}>
                  {r.check_in} → {r.check_out}
                </Meta>
                <Meta icon={Users}>{t("dashboard.guestsCount", { count: r.guests_count })}</Meta>
                <Meta icon={BedDouble}>{t("dashboard.roomsCount", { count: r.rooms_needed })}</Meta>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {t("landing.openRequests.awaitingQuotations")}
              </div>

              <div className="mt-5">
                <Button
                  asChild
                  variant="outline"
                  className="w-full group-hover:bg-brand-blue group-hover:text-brand-blue-foreground group-hover:border-brand-blue transition"
                >
                  <Link to="/requests/$id" params={{ id: r.id }}>
                    {t("admin.common.actions.viewDetails")}{" "}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Meta({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

/* ────────────────────  FEATURED HOTELS  ──────────────────── */

function FeaturedHotelsSection({ accessToken }: { accessToken?: string }) {
  const { t } = useTranslation();
  const { data: featured = [] } = useQuery({
    queryKey: ["featured-hotels-home"],
    enabled: !!accessToken,
    queryFn: async () => {
      return fetchPublicRows<any>(
        "hotels",
        {
          select: "id,slug,name,city,country,star_rating,cover_image,description",
          status: "eq.approved",
          featured: "eq.true",
          limit: 6,
        },
        { accessToken },
      );
    },
  });
  if (featured.length === 0) return null;

  return (
    <section className="bg-card border-y border-border">
      <div className="container-page py-16 md:py-20">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <h2 className="font-display text-3xl md:text-4xl text-primary">
              {t("featured.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("featured.subtitle")}</p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/hotels">
              {t("buttons.viewAll")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((h: any) => (
            <Link
              key={h.id}
              to="/hotels/$id"
              params={{ id: h.id }}
              className="group rounded-2xl overflow-hidden border border-border bg-card hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] transition block"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {h.cover_image ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={h.cover_image}
                    alt={h.name}
                    width={640}
                    height={480}
                    className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="h-full w-full grid place-items-center text-muted-foreground">
                    <Hotel className="h-10 w-10" />
                  </div>
                )}
                <Badge className="absolute top-3 left-3 bg-premium text-premium-foreground border-0 uppercase tracking-wider text-[10px]">
                  <Sparkles className="h-3 w-3 mr-1" /> {t("landing.featured.badge")}
                </Badge>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-0.5 text-premium mb-1">
                  {Array.from({ length: h.star_rating ?? 0 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <h3 className="font-display text-lg text-primary font-semibold">{h.name}</h3>
                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" /> {h.city}, {h.country}
                </div>
                {h.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{h.description}</p>
                )}
                <div className="mt-4">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue group-hover:gap-2 transition-all">
                    {t("admin.hotelListings.actions.viewHotel")}{" "}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────  WHY GROUPTOSTAY  ──────────────────── */

function WhyGroupToStay() {
  const { t } = useTranslation();
  const items = [
    {
      icon: Clock,
      title: t("landing.why.items.saveTime.title"),
      desc: t("landing.why.items.saveTime.description"),
    },
    {
      icon: FileText,
      title: t("landing.why.items.multipleOffers.title"),
      desc: t("landing.why.items.multipleOffers.description"),
    },
    {
      icon: MessageSquare,
      title: t("landing.why.items.directCommunication.title"),
      desc: t("landing.why.items.directCommunication.description"),
    },
    {
      icon: Handshake,
      title: t("landing.why.items.groupRates.title"),
      desc: t("landing.why.items.groupRates.description"),
    },
  ];
  return (
    <section className="bg-surface">
      <div className="container-page grid gap-10 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:py-20">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl text-primary md:text-4xl">
            {t("landing.why.title")}
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {t("landing.why.subtitle")}
          </p>
        </div>
        <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
          {items.map((s) => (
            <div key={s.title} className="flex gap-4 border-t border-border py-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-gold/25 bg-gold/10 text-gold-foreground">
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────  TRUST  ──────────────────── */

function TrustSection() {
  const { t } = useTranslation();
  const items = [
    {
      icon: BadgeCheck,
      title: t("landing.trust.items.approvedHotels.title"),
      desc: t("landing.trust.items.approvedHotels.description"),
    },
    {
      icon: ShieldCheck,
      title: t("landing.trust.items.verifiedCompanies.title"),
      desc: t("landing.trust.items.verifiedCompanies.description"),
    },
    {
      icon: Lock,
      title: t("landing.trust.items.securePlatform.title"),
      desc: t("landing.trust.items.securePlatform.description"),
    },
    {
      icon: Handshake,
      title: t("landing.trust.items.directCommunication.title"),
      desc: t("landing.trust.items.directCommunication.description"),
    },
  ];
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="container-page py-14 md:py-16">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((s) => (
            <div key={s.title} className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-gold/30 bg-gold/10 text-gold">
                <s.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="font-semibold">{s.title}</div>
                <div className="mt-1 text-sm leading-6 text-primary-foreground/70">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────  CTA + MESSAGES  ──────────────────── */

function CtaBanner({ isHotel, isOrganizer }: { isHotel: boolean; isOrganizer?: boolean }) {
  const { t } = useTranslation();
  const ctaTo = isHotel ? "/requests" : "/request-quote";
  const ctaLabel = isHotel
    ? t("landing.actions.browseOpenRequests")
    : isOrganizer
      ? t("nav.createRequestShort")
      : t("nav.createRequest");
  return (
    <section className="container-page py-16">
      <div className="rounded-lg border border-primary/10 bg-primary p-8 text-primary-foreground shadow-[var(--shadow-elevated)] md:p-12">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <h3 className="font-display text-3xl md:text-4xl">
              {isHotel ? t("landing.cta.hotelTitle") : t("landing.cta.agencyTitle")}
            </h3>
            <p className="mt-2 text-primary-foreground/80 max-w-xl">
              {isHotel ? t("landing.cta.hotelDescription") : t("landing.cta.agencyDescription")}
            </p>
          </div>
          <Button asChild size="lg" variant="hero">
            <Link to={ctaTo}>
              {ctaLabel} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function MessagesBar({ userId, accessToken }: { userId: string; accessToken?: string }) {
  const { t } = useTranslation();
  const { data: messages = [] } = useQuery({
    queryKey: ["home-messages", userId],
    enabled: !!accessToken,
    queryFn: async () => {
      return fetchPublicRows<any>(
        "messages",
        {
          select: "id,body,created_at,sender_id,recipient_id,rfq_id,rfqs(id,group_name)",
          or: `(sender_id.eq.${userId},recipient_id.eq.${userId})`,
          order: "created_at.desc",
          limit: 5,
        },
        { accessToken },
      );
    },
  });

  if (messages.length === 0) return null;

  return (
    <section className="container-page py-12">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-blue/10 text-brand-blue">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-xl text-primary">{t("home.messages.title")}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {t("home.messages.subtitle")}
              </p>
            </div>
          </div>
          <Button asChild variant="ghost">
            <Link to="/dashboard">
              {t("home.messages.openInbox")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
        <div className="mt-5 divide-y divide-border">
          {messages.map((m: any) => {
            const incoming = m.recipient_id === userId;
            return (
              <Link
                key={m.id}
                to="/dashboard/rfqs/$id"
                params={{ id: m.rfq_id }}
                className="flex items-start gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-md transition"
              >
                <span
                  className={`mt-1 h-2 w-2 rounded-full ${incoming ? "bg-premium" : "bg-muted-foreground/40"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-foreground truncate">
                      {m.rfqs?.group_name ?? t("home.messages.thread")}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {incoming ? "" : t("home.messages.youPrefix") + " "}
                    {m.body}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
