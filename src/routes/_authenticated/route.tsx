import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { SiteHeader } from "@/components/site-header";
import { useUnreadMessageCount } from "@/hooks/use-unread-messages";
import { LayoutDashboard, FileText, Plus, Building2, Inbox, ShieldCheck, User, Globe, MessageSquare } from "lucide-react";

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
  const { isHotel, isAdmin } = useRoles();

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
              {!isAdmin && isHotel && (
                <>
                  <Link to="/dashboard/hotel" className={navItem} activeProps={{ className: "active" }}>
                    <Building2 className="h-4 w-4" /> {t("hotelDash.myHotel")}
                  </Link>
                  <Link to="/requests" className={navItem} activeProps={{ className: "active" }}>
                    <Globe className="h-4 w-4" /> {t("hotelDash.browseRequests", "Browse requests")}
                  </Link>
                  <Link to="/dashboard/invitations" className={navItem} activeProps={{ className: "active" }}>
                    <Inbox className="h-4 w-4" /> {t("hotelDash.invitations")}
                  </Link>
                </>
              )}
              {!isAdmin && !isHotel && (
                <>
                  <Link to="/dashboard/rfqs" className={navItem} activeProps={{ className: "active" }}>
                    <FileText className="h-4 w-4" /> {t("dashboard.myRfqs")}
                  </Link>
                  <Link to="/dashboard/rfqs/new" className={navItem} activeProps={{ className: "active" }}>
                    <Plus className="h-4 w-4" /> {t("dashboard.newRfq")}
                  </Link>
                </>
              )}
              {isAdmin && (
                <Link to="/dashboard/admin" className={navItem} activeProps={{ className: "active" }}>
                  <ShieldCheck className="h-4 w-4" /> {t("admin.title")}
                </Link>
              )}
              <Link to="/dashboard/profile" className={navItem} activeProps={{ className: "active" }}>
                <User className="h-4 w-4" /> {t("profile.title")}
              </Link>
            </nav>
          </div>
        </aside>
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}
