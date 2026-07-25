import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, LayoutDashboard, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { getPublicHeaderVisibility } from "@/lib/public-header-visibility";

export function PublicSiteHeader() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { isOrganizer, isHotel, isAdmin, loading: rolesLoading } = useRoles();
  const [open, setOpen] = useState(false);
  const visibility = getPublicHeaderVisibility({
    authLoading,
    rolesLoading,
    isAuthenticated: !!user,
    isOrganizer,
    isHotel,
    isAdmin,
  });
  const items = [
    { to: "/", label: t("nav.home") },
    { to: "/how-it-works", label: t("nav.howItWorks") },
    { to: "/pricing", label: t("nav.pricing") },
    { to: "/about", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ];
  const linkCls = "text-sm font-medium text-foreground/80 hover:text-foreground transition";
  const navLinks = (
    <>
      {items.map((it) => (
        <Link key={it.to} to={it.to} className={linkCls}>
          {it.label}
        </Link>
      ))}
    </>
  );
  const workspaceTo = isAdmin ? "/admin" : isHotel ? "/dashboard/hotel" : "/dashboard";

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

        <div className="ms-auto flex min-w-0 items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          {visibility.ready && user ? (
            <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
              <Link to={workspaceTo}>
                <LayoutDashboard className="h-4 w-4" />
                {t("nav.dashboard")}
              </Link>
            </Button>
          ) : null}
          {visibility.showSignIn && (
            <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
              <Link to="/auth">{t("nav.signIn")}</Link>
            </Button>
          )}
          {visibility.showRegister && (
            <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
              <Link to="/auth" search={{ mode: "signup" } as any}>
                {t("nav.register")}
              </Link>
            </Button>
          )}
          {visibility.showCreateRequest && (
            <Button asChild variant="gold" size="sm" className="hidden lg:inline-flex">
              <Link to="/request-quote">{t("nav.getQuote")}</Link>
            </Button>
          )}
          <button
            className="grid h-10 w-10 place-items-center rounded-md text-foreground transition-colors hover:bg-accent lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={t("navigation:nav.menu")}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background shadow-sm lg:hidden">
          <div className="container-page flex flex-col gap-1 py-3" onClick={() => setOpen(false)}>
            {navLinks}
            {visibility.ready && user ? (
              <Link
                to={workspaceTo}
                className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-accent"
              >
                <LayoutDashboard className="h-4 w-4" />
                {t("nav.dashboard")}
              </Link>
            ) : null}
            {visibility.showSignIn && (
              <Link
                to="/auth"
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-accent"
              >
                {t("nav.signIn")}
              </Link>
            )}
            {visibility.showRegister && (
              <Link
                to="/auth"
                search={{ mode: "signup" } as any}
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-accent"
              >
                {t("nav.register")}
              </Link>
            )}
            {visibility.showCreateRequest && (
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
