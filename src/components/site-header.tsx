import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/notification-bell";
import { Building2, Menu, X } from "lucide-react";
import { useState } from "react";

type NavItem = { to: string; label: string; search?: Record<string, unknown> };

export function SiteHeader() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isHotel, isOrganizer, isAdmin } = useRoles();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await signOut();
    } finally {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        // Storage cleanup is best-effort during sign out.
      }
      window.location.replace("/");
    }
  };

  // Role-based navigation. GroupToStay is a B2B RFQ marketplace — no public hotel directory.
  // "Hotels" is admin-only. Agencies never browse hotels; Hotels never browse other hotels.
  let items: NavItem[] = [];
  if (isAdmin) {
    items = [
      { to: "/", label: t("nav.home") },
      { to: "/admin/hotel-listings", label: t("nav.hotels") },
      { to: "/admin/agency-verifications", label: t("nav.agencies") },
      { to: "/admin/group-requests", label: t("nav.groupRequests") },
      { to: "/admin/users", label: t("nav.users") },
      { to: "/admin", label: t("nav.dashboard") },
    ];
  } else if (isHotel) {
    items = [
      { to: "/", label: t("nav.home") },
      { to: "/dashboard/invitations", label: t("nav.openRequests") },
      { to: "/dashboard/invitations", label: t("nav.myQuotations") },
      { to: "/dashboard/hotel", label: t("nav.manageHotelProfile") },
      { to: "/dashboard/hotel", label: t("nav.dashboard") },
    ];
  } else if (user && isOrganizer) {
    items = [
      { to: "/", label: t("nav.home") },
      { to: "/dashboard/rfqs/new", label: t("nav.createRequestShort") },
      { to: "/dashboard/rfqs", label: t("nav.myRequests") },
      { to: "/dashboard/quotations", label: t("nav.receivedOffers") },
      { to: "/dashboard", label: t("nav.dashboard") },
    ];
  } else {
    // Visitor
    items = [
      { to: "/", label: t("nav.home") },
      { to: "/how-it-works", label: t("nav.howItWorks") },
      { to: "/pricing", label: t("nav.pricing") },
      { to: "/about", label: t("nav.about") },
      { to: "/contact", label: t("nav.contact") },
    ];
  }

  const linkCls =
    "flex min-h-10 items-center rounded-md px-1 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground";
  const navLinks = (
    <>
      {items.map((it, i) => (
        <Link key={`${it.to}-${i}`} to={it.to} search={it.search as any} className={linkCls}>
          {it.label}
        </Link>
      ))}
    </>
  );

  const showQuoteCta = !user || isOrganizer;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="container-page flex h-16 items-center gap-5">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-gold shadow-sm">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold">{t("common.brand.name")}</span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">{navLinks}</nav>

        <div className="ms-auto flex items-center gap-1 sm:gap-2 min-w-0">
          <LanguageSwitcher />
          {user ? (
            <>
              <NotificationBell />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="hidden lg:inline-flex"
              >
                {t("nav.signOut")}
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
                <Link to="/auth">{t("nav.signIn")}</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
                <Link to="/auth" search={{ mode: "signup" } as any}>
                  {t("nav.register")}
                </Link>
              </Button>
            </>
          )}
          {showQuoteCta && (
            <Button asChild variant="gold" size="sm" className="hidden lg:inline-flex">
              <Link to="/request-quote">{t("nav.getQuote")}</Link>
            </Button>
          )}
          <button
            className="grid h-10 w-10 place-items-center rounded-md transition-colors hover:bg-accent lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={t("navigation:nav.menu")}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background shadow-sm lg:hidden">
          <div className="container-page flex flex-col gap-1 py-3" onClick={() => setOpen(false)}>
            {navLinks}
            {user ? (
              <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
                {t("nav.signOut")}
              </Button>
            ) : (
              <>
                <Link to="/auth" className="text-sm font-medium">
                  {t("nav.signIn")}
                </Link>
                <Link to="/auth" search={{ mode: "signup" } as any} className="text-sm font-medium">
                  {t("nav.register")}
                </Link>
              </>
            )}
            {showQuoteCta && (
              <Button asChild variant="gold" size="sm" className="w-full">
                <Link to="/request-quote">{t("nav.getQuote")}</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
