import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { SiteHeader } from "@/components/site-header";
import { useUnreadMessageCount } from "@/hooks/use-unread-messages";
import {
  Bell,
  BadgeCheck,
  CalendarCheck,
  CircleDollarSign,
  LayoutDashboard,
  FileText,
  Plus,
  Building2,
  Inbox,
  ShieldCheck,
  User,
  Users,
  MessageSquare,
  CreditCard,
  Settings as SettingsIcon,
  Server,
} from "lucide-react";
import { WorkspaceShell, type WorkspaceNavGroup } from "@/components/workspace/workspace-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", reloadDocument: true });
    }
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isHotel, isAdmin, isOrganizer } = useRoles();
  const unread = useUnreadMessageCount();
  const unreadBadge =
    unread > 0 ? (
      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gold px-1.5 py-0.5 text-[11px] font-semibold leading-none text-gold-foreground">
        {unread}
      </span>
    ) : undefined;

  let groups: WorkspaceNavGroup[] = [];
  let roleLabel = t("role.agency");

  if (isAdmin) {
    roleLabel = t("role.admin");
    groups = [
      {
        items: [
          {
            to: "/admin",
            label: t("nav.overview"),
            icon: LayoutDashboard,
            exact: true,
          },
        ],
      },
      {
        items: [
          {
            to: "/admin/hotel-companies",
            label: t("admin.hotelCompanies.title"),
            icon: Building2,
          },
          {
            to: "/admin/hotel-listings",
            label: t("admin.hotelListings.title"),
            icon: Inbox,
          },
          {
            to: "/admin/agency-verifications",
            label: t("admin.agencyVerifications.title"),
            icon: BadgeCheck,
          },
          {
            to: "/admin/group-requests",
            label: t("nav.groupRequests"),
            icon: FileText,
          },
          {
            to: "/dashboard/bookings",
            label: t("dashboard.bookings.navLabel"),
            icon: CalendarCheck,
          },
        ],
      },
      {
        items: [
          { to: "/admin/users", label: t("nav.users"), icon: Users },
          {
            to: "/admin/subscription-interest",
            label: t("nav.subscriptionInterest"),
            icon: CircleDollarSign,
          },
          {
            to: "/admin/subscriptions",
            label: t("nav.subscriptions"),
            icon: CreditCard,
            badge: (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {t("common.soon")}
              </span>
            ),
          },
          { to: "/admin/settings", label: t("nav.settings"), icon: SettingsIcon },
        ],
      },
    ];
  } else if (isHotel) {
    roleLabel = t("role.hotel");
    groups = [
      {
        items: [
          {
            to: "/dashboard",
            label: t("dashboard.welcome"),
            icon: LayoutDashboard,
            exact: true,
          },
          {
            to: "/dashboard/invitations",
            label: t("nav.groupRequests"),
            icon: Inbox,
          },
          {
            to: "/dashboard/messages",
            label: t("dashboard.messagesTitle"),
            icon: MessageSquare,
            badge: unreadBadge,
          },
          {
            to: "/dashboard/bookings",
            label: t("dashboard.bookings.navLabel"),
            icon: CalendarCheck,
          },
          {
            to: "/dashboard/notifications",
            label: t("notifications.title"),
            icon: Bell,
          },
        ],
      },
      {
        items: [
          {
            to: "/dashboard/hotel",
            label: t("nav.hotelProfile"),
            icon: Building2,
            exact: true,
          },
          {
            to: "/dashboard/hotel/pms",
            label: t("nav.pmsIntegration"),
            icon: Server,
          },
          { to: "/pricing", label: t("nav.subscription"), icon: CreditCard },
          { to: "/dashboard/profile", label: t("profile.title"), icon: User },
        ],
      },
    ];
  } else if (isOrganizer) {
    groups = [
      {
        items: [
          {
            to: "/dashboard",
            label: t("dashboard.welcome"),
            icon: LayoutDashboard,
            exact: true,
          },
          {
            to: "/dashboard/rfqs/new",
            label: t("nav.createRequest"),
            icon: Plus,
          },
          {
            to: "/dashboard/rfqs",
            label: t("nav.myRequests"),
            icon: FileText,
          },
          {
            to: "/dashboard/quotations",
            label: t("nav.receivedOffers"),
            icon: CircleDollarSign,
          },
          {
            to: "/dashboard/bookings",
            label: t("dashboard.bookings.navLabel"),
            icon: CalendarCheck,
          },
          {
            to: "/dashboard/messages",
            label: t("dashboard.messagesTitle"),
            icon: MessageSquare,
            badge: unreadBadge,
          },
          {
            to: "/dashboard/notifications",
            label: t("notifications.title"),
            icon: Bell,
          },
        ],
      },
      {
        items: [
          {
            to: "/dashboard/agency-profile",
            label: t("nav.agencyProfile"),
            icon: ShieldCheck,
          },
          { to: "/dashboard/profile", label: t("nav.myProfile"), icon: User },
        ],
      },
    ];
  }

  const identity = (
    <div className="min-w-0">
      <div className="text-xs font-semibold text-muted-foreground">{roleLabel}</div>
      <div className="truncate text-sm font-medium text-foreground">{user?.email}</div>
    </div>
  );

  return (
    <WorkspaceShell
      brand={t("common.brand.name")}
      identity={identity}
      groups={groups}
      header={<SiteHeader />}
      wide={isAdmin}
    >
      <Outlet />
    </WorkspaceShell>
  );
}
