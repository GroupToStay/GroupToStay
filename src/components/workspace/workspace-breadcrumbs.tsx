import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles } from "@/hooks/use-role";
import { cn } from "@/lib/utils";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function WorkspaceBreadcrumbs() {
  const { t } = useTranslation();
  const { isAdmin, isHotel, loading } = useRoles();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const root = isAdmin && pathname.startsWith("/admin") ? "/admin" : "/dashboard";
  const rootLabel = isAdmin
    ? t("navigation:breadcrumbs.admin")
    : isHotel
      ? t("navigation:breadcrumbs.hotel")
      : t("navigation:breadcrumbs.agency");
  const segments = pathname.split("/").filter(Boolean);
  const rootIndex = segments.indexOf(root.slice(1));
  const relevant = rootIndex >= 0 ? segments.slice(rootIndex + 1) : [];
  const labelMap: Record<string, string> = {
    rfqs: t("nav.myRequests"),
    new: t("nav.createRequestShort"),
    compare: t("dashboard.compare.title"),
    quotations: t("nav.receivedOffers"),
    invitations: t("nav.openRequests"),
    bookings: t("dashboard.bookings.navLabel"),
    messages: t("dashboard.messagesTitle"),
    notifications: t("notifications.title"),
    profile: t("profile.title"),
    hotel: t("nav.hotelProfile"),
    pms: t("nav.pmsIntegration"),
    users: t("nav.users"),
    "group-requests": t("nav.groupRequests"),
    "hotel-companies": t("admin.hotelCompanies.title"),
    "hotel-listings": t("admin.hotelListings.title"),
    "agency-verifications": t("admin.agencyVerifications.title"),
    "subscription-interest": t("nav.subscriptionInterest"),
    subscriptions: t("nav.subscriptions"),
    settings: t("nav.settings"),
    "agency-profile": t("nav.agencyProfile"),
  };

  const crumbs = relevant.map((segment, index) => {
    const previous = relevant.slice(0, index);
    const href = `${root}/${[...previous, segment].join("/")}`;
    return {
      href,
      label: UUID_PATTERN.test(segment)
        ? t("navigation:breadcrumbs.details")
        : labelMap[segment] || segment.replace(/-/g, " "),
    };
  });

  if (loading) {
    return (
      <div className="mb-5 flex min-h-11 items-center gap-2" aria-hidden="true">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-28" />
      </div>
    );
  }

  return (
    <nav aria-label={t("common.accessibility.breadcrumb")} className="mb-5 overflow-x-auto">
      <ol className="flex min-h-11 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
        <li>
          <Link
            to={root}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 hover:bg-muted hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            {rootLabel}
          </Link>
        </li>
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              {current ? (
                <span
                  className="max-w-52 truncate px-2 font-medium text-foreground"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.href as any}
                  className={cn(
                    "inline-flex min-h-11 max-w-44 items-center truncate rounded-md px-2 capitalize",
                    "hover:bg-muted hover:text-foreground",
                  )}
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
