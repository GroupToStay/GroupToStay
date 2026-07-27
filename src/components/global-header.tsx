import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/global-search";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationPanel } from "@/components/notification-panel";
import { UserMenu } from "@/components/user-menu";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { getPublicHeaderVisibility } from "@/lib/public-header-visibility";
import { cn } from "@/lib/utils";

type HeaderLink = { to: string; label: string };

export function GlobalHeader() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isHotel, isOrganizer, loading: rolesLoading } = useRoles();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const ready = !authLoading && (!user || !rolesLoading);
  const visibility = getPublicHeaderVisibility({
    authLoading,
    rolesLoading,
    isAuthenticated: !!user,
    isOrganizer,
    isHotel,
    isAdmin,
  });

  const links = useMemo<HeaderLink[]>(() => {
    if (!ready) return [];
    if (isAdmin) {
      return [
        { to: "/", label: t("nav.home") },
        { to: "/admin/hotel-listings", label: t("nav.hotels") },
        { to: "/admin/agency-verifications", label: t("nav.agencies") },
        { to: "/admin/group-requests", label: t("nav.groupRequests") },
        { to: "/admin/users", label: t("nav.users") },
      ];
    }
    if (isHotel) {
      return [
        { to: "/", label: t("nav.home") },
        { to: "/dashboard/invitations", label: t("nav.openRequests") },
        { to: "/dashboard/invitations", label: t("nav.myQuotations") },
        { to: "/dashboard/hotel", label: t("nav.manageHotelProfile") },
      ];
    }
    if (user && isOrganizer) {
      return [
        { to: "/", label: t("nav.home") },
        { to: "/dashboard/rfqs/new", label: t("nav.createRequestShort") },
        { to: "/dashboard/rfqs", label: t("nav.myRequests") },
        { to: "/dashboard/quotations", label: t("nav.receivedOffers") },
      ];
    }
    return [
      { to: "/", label: t("nav.home") },
      { to: "/how-it-works", label: t("nav.howItWorks") },
      { to: "/pricing", label: t("nav.pricing") },
      { to: "/about", label: t("nav.about") },
      { to: "/contact", label: t("nav.contact") },
    ];
  }, [isAdmin, isHotel, isOrganizer, ready, t, user]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-200",
        scrolled
          ? "border-border bg-background/95 shadow-sm backdrop-blur-xl"
          : "border-transparent bg-background/85 backdrop-blur-md",
      )}
    >
      <div className="container-page flex h-16 items-center gap-2 lg:gap-4">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("common.brand.name")}
        >
          <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-gold shadow-sm">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="hidden font-display text-xl font-semibold sm:inline">
            {t("common.brand.name")}
          </span>
        </Link>

        <nav className="hidden min-w-0 items-center gap-4 xl:flex" aria-label={t("nav.menu")}>
          {links.map((item, index) => (
            <Link
              key={`${item.to}-${index}`}
              to={item.to}
              className="flex min-h-11 items-center whitespace-nowrap rounded-md px-1 text-sm font-medium text-foreground/75 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex min-w-0 items-center gap-1 sm:gap-1.5">
          <GlobalSearch />
          <LanguageSwitcher />
          {ready && user ? (
            <>
              <NotificationPanel />
              <UserMenu />
            </>
          ) : (
            <>
              {visibility.showSignIn ? (
                <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex">
                  <Link to="/auth">{t("nav.signIn")}</Link>
                </Button>
              ) : null}
              {visibility.showRegister ? (
                <Button asChild variant="outline" size="sm" className="hidden xl:inline-flex">
                  <Link to="/auth" search={{ mode: "signup" } as any}>
                    {t("nav.register")}
                  </Link>
                </Button>
              ) : null}
              {visibility.showCreateRequest ? (
                <Button asChild variant="gold" size="sm" className="hidden xl:inline-flex">
                  <Link to="/request-quote">{t("nav.getQuote")}</Link>
                </Button>
              ) : null}
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 xl:hidden"
            onClick={() => setMobileOpen((current) => !current)}
            aria-label={t("nav.menu")}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-border bg-background shadow-sm xl:hidden">
          <nav
            className="container-page flex max-h-[calc(100vh-4rem)] flex-col gap-1 overflow-y-auto py-3"
            aria-label={t("nav.menu")}
            onClick={() => setMobileOpen(false)}
          >
            {links.map((item, index) => (
              <Link
                key={`${item.to}-${index}`}
                to={item.to}
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-accent"
              >
                {item.label}
              </Link>
            ))}
            {!user && visibility.ready ? (
              <div className="mt-2 grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
                {visibility.showSignIn ? (
                  <Button asChild variant="ghost">
                    <Link to="/auth">{t("nav.signIn")}</Link>
                  </Button>
                ) : null}
                {visibility.showRegister ? (
                  <Button asChild variant="outline">
                    <Link to="/auth" search={{ mode: "signup" } as any}>
                      {t("nav.register")}
                    </Link>
                  </Button>
                ) : null}
                {visibility.showCreateRequest ? (
                  <Button asChild variant="gold">
                    <Link to="/request-quote">{t("nav.getQuote")}</Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
