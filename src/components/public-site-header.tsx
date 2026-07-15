import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Menu, X } from "lucide-react";
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

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container-page flex h-16 items-center gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-gold">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            {t("common.brand.name")}
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6">{navLinks}</nav>

        <div className="ms-auto flex items-center gap-1 sm:gap-2 min-w-0">
          <LanguageSwitcher />
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
            className="lg:hidden p-2"
            onClick={() => setOpen((v) => !v)}
            aria-label={t("navigation:nav.menu")}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-border bg-background">
          <div className="container-page py-4 flex flex-col gap-3" onClick={() => setOpen(false)}>
            {navLinks}
            {visibility.showSignIn && (
              <Link to="/auth" className="text-sm font-medium">
                {t("nav.signIn")}
              </Link>
            )}
            {visibility.showRegister && (
              <Link to="/auth" search={{ mode: "signup" } as any} className="text-sm font-medium">
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
