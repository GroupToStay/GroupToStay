import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { SiteHeader } from "@/components/site-header";
import { useUnreadMessageCount } from "@/hooks/use-unread-messages";
import { LayoutDashboard, FileText, Plus, Building2, Inbox, ShieldCheck, User, MessageSquare, CreditCard, Settings as SettingsIcon, Server } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isHotel, isAdmin, isOrganizer } = useRoles();
  const unread = useUnreadMessageCount();

  const navItem = "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent [&.active]:bg-primary [&.active]:text-primary-foreground";

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <div className="container-page py-8 grid lg:grid-cols-[220px_1fr] gap-8 flex-1">
        <aside className="lg:sticky lg:top-24 h-fit">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="px-2 py-2 text-sm font-semibold text-muted-foreground">{t("dashboard.welcome")}</div>
            <div className="px-2 pb-3 text-sm text-foreground truncate">{user?.email}</div>
            <nav className="flex flex-col gap-1">
              <Link to="/dashboard" activeOptions={{ exact: true }} className={navItem} activeProps={{ className: "active" }}>
                <LayoutDashboard className="h-4 w-4" /> {t("dashboard.welcome")}
              </Link>

              {isAdmin && (
                <>
                  <Link to="/dashboard/admin" search={{ tab: "companies" } as any} className={navItem} activeProps={{ className: "active" }}>
                    <Building2 className="h-4 w-4" /> Hotel Companies
                  </Link>
                  <Link to="/dashboard/admin" search={{ tab: "hotels" } as any} className={navItem} activeProps={{ className: "active" }}>
                    <Inbox className="h-4 w-4" /> Hotel Listings
                  </Link>
                  <Link to="/dashboard/admin" search={{ tab: "interest" } as any} className={navItem} activeProps={{ className: "active" }}>
                    <ShieldCheck className="h-4 w-4" /> Subscription Interest
                  </Link>
                  <span className={`${navItem} opacity-60 cursor-not-allowed`}>
                    <CreditCard className="h-4 w-4" />
                    <span className="flex-1">Subscriptions</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Soon</span>
                  </span>
                  <Link to="/dashboard/profile" className={navItem} activeProps={{ className: "active" }}>
                    <SettingsIcon className="h-4 w-4" /> {t("nav.settings")}
                  </Link>
                </>
              )}

              {!isAdmin && isHotel && (
                <>
                  <Link to="/dashboard/invitations" className={navItem} activeProps={{ className: "active" }}>
                    <Inbox className="h-4 w-4" /> {t("nav.groupRequests")}
                  </Link>
                  <Link to="/dashboard/messages" className={navItem} activeProps={{ className: "active" }}>
                    <MessageSquare className="h-4 w-4" />
                    <span className="flex-1">{t("dashboard.messages")}</span>
                    {unread > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gold text-primary text-[11px] font-semibold">
                        {unread}
                      </span>
                    )}
                  </Link>
                  <Link to="/dashboard/hotel" className={navItem} activeProps={{ className: "active" }} activeOptions={{ exact: true }}>
                    <Building2 className="h-4 w-4" /> {t("nav.hotelProfile")}
                  </Link>
                  <Link to="/dashboard/hotel/pms" className={navItem} activeProps={{ className: "active" }}>
                    <Server className="h-4 w-4" /> PMS Integration
                  </Link>

                  <Link to="/pricing" className={navItem} activeProps={{ className: "active" }}>
                    <CreditCard className="h-4 w-4" /> {t("nav.subscription")}
                  </Link>
                  <Link to="/dashboard/profile" className={navItem} activeProps={{ className: "active" }}>
                    <User className="h-4 w-4" /> {t("profile.title")}
                  </Link>
                </>
              )}

              {!isAdmin && !isHotel && isOrganizer && (
                <>
                  <Link to="/dashboard/rfqs/new" className={navItem} activeProps={{ className: "active" }}>
                    <Plus className="h-4 w-4" /> {t("nav.createRequest")}
                  </Link>
                  <Link to="/dashboard/rfqs" className={navItem} activeProps={{ className: "active" }}>
                    <FileText className="h-4 w-4" /> {t("nav.myRequests")}
                  </Link>
                  <Link to="/dashboard/messages" className={navItem} activeProps={{ className: "active" }}>
                    <MessageSquare className="h-4 w-4" />
                    <span className="flex-1">{t("dashboard.messages")}</span>
                    {unread > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gold text-primary text-[11px] font-semibold">
                        {unread}
                      </span>
                    )}
                  </Link>
                  <Link to="/dashboard/profile" className={navItem} activeProps={{ className: "active" }}>
                    <User className="h-4 w-4" /> My Profile
                  </Link>
                </>
              )}
            </nav>
          </div>
        </aside>
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}
