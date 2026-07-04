import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Hotel,
  Users,
  CreditCard,
  Sparkles,
  ShieldCheck,
  Inbox,
  BadgeCheck,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — GroupToStay" }] }),
  component: AdminHome,
});

function AdminHome() {
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
        hotelUsers: rolesHotel.count ?? 0,
        subActive: subActive.count ?? 0,
        subWaiting: subWaiting.count ?? 0,
      };
    },
  });

  const sections: {
    title: string;
    tint: string;
    cards: { label: string; value: number | string }[];
  }[] = [
    {
      title: "Hotels",
      tint: "text-brand-blue bg-brand-blue/10",
      cards: [
        { label: "Total Hotel Companies", value: stats?.companiesTotal ?? 0 },
        { label: "Approved Hotels", value: stats?.companiesApproved ?? 0 },
        { label: "Pending Hotels", value: stats?.companiesPending ?? 0 },
        { label: "Rejected Hotels", value: stats?.companiesRejected ?? 0 },
      ],
    },
    {
      title: "Listings",
      tint: "text-premium bg-premium/15",
      cards: [
        { label: "Total Listings", value: stats?.listingsTotal ?? 0 },
        { label: "Active Listings", value: stats?.listingsApproved ?? 0 },
        { label: "Pending Listings", value: stats?.listingsPending ?? 0 },
      ],
    },
    {
      title: "Users",
      tint: "text-success bg-success/10",
      cards: [
        { label: "Total Agencies", value: stats?.agencies ?? 0 },
        { label: "Total Hotel Accounts", value: stats?.hotelUsers ?? 0 },
      ],
    },
    {
      title: "Subscriptions",
      tint: "text-primary bg-primary/10",
      cards: [
        { label: "Active Subscriptions", value: stats?.subActive ?? 0 },
        { label: "Pending Subscription Requests", value: stats?.subWaiting ?? 0 },
      ],
    },
  ];

  const quickActions = [
    {
      title: "Hotel Companies",
      desc: "Review and approve hotel companies.",
      to: "/admin/hotel-companies",
      icon: Building2,
      badge: null as string | null,
    },
    {
      title: "Hotel Listings",
      desc: "Review hotel listings.",
      to: "/admin/hotel-listings",
      icon: Hotel,
      badge: null,
    },
    {
      title: "Agency Verifications",
      desc: "Review agency verification submissions.",
      to: "/admin/agency-verifications",
      icon: BadgeCheck,
      badge: null,
    },
    {
      title: "Group Requests",
      desc: "Review marketplace RFQs.",
      to: "/admin/group-requests",
      icon: FileText,
      badge: null,
    },
    {
      title: "Users",
      desc: "Review user accounts and roles.",
      to: "/admin/users",
      icon: Users,
      badge: null,
    },
    {
      title: "Subscription Interest",
      desc: "Hotels requesting subscriptions.",
      to: "/admin/subscription-interest",
      icon: Inbox,
      badge: null,
    },
    {
      title: "Subscriptions",
      desc: "Subscription billing module.",
      to: "/admin/subscriptions",
      icon: CreditCard,
      badge: "Coming Soon",
    },
    {
      title: "Settings",
      desc: "Platform & profile settings.",
      to: "/admin/settings",
      icon: ShieldCheck,
      badge: null,
    },
  ];

  return (
    <section className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-br from-[oklch(0.18_0.04_265)] to-[oklch(0.32_0.10_264)] text-primary-foreground p-8 md:p-10">
        <Badge className="bg-premium text-premium-foreground border-0 mb-3 uppercase tracking-wider">
          Admin Console
        </Badge>
        <h1 className="font-display text-3xl md:text-4xl font-semibold">Admin Dashboard</h1>
        <p className="mt-2 text-primary-foreground/80 max-w-2xl">
          Management statistics and platform overview. Use the sidebar to manage hotel companies,
          listings, and subscriptions.
        </p>
      </div>

      <div className="space-y-8">
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

      <div>
        <h2 className="font-display text-xl text-primary mb-3">Quick Actions</h2>
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
            ) : (
              <Link key={qa.title} to={qa.to}>
                {Inner}
              </Link>
            );
          })}
        </div>
      </div>

      <RecentActivity />
    </section>
  );
}

function RecentActivity() {
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
            ? `Hotel approved: ${h.name}`
            : isSuspended
              ? `Hotel rejected: ${h.name}`
              : `New listing: ${h.name}`,
        });
      });
      (interest.data ?? []).forEach((r: any) => {
        items.push({
          key: `i-${r.id}`,
          when: r.created_at,
          icon: CreditCard,
          tint: "text-premium bg-premium/15",
          text: `Subscription request (${r.requested_plan}) — ${r.hotel_name ?? r.full_name}`,
        });
      });
      return items
        .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
        .slice(0, 10);
    },
  });

  return (
    <div>
      <h2 className="font-display text-xl text-primary mb-3 flex items-center gap-2">
        <Users className="h-5 w-5" /> Recent Activity
      </h2>
      <Card>
        <CardContent className="p-0">
          {activity.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No recent activity.</div>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((a) => (
                <li key={a.key} className="flex items-center gap-3 p-4">
                  <span className={`grid h-9 w-9 place-items-center rounded-lg ${a.tint}`}>
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
    </div>
  );
}
