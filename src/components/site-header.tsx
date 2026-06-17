import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Building2, Menu, X } from "lucide-react";
import { useState } from "react";

export function SiteHeader() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isHotel, isOrganizer, isAdmin } = useRoles();
  const showQuoteCta = !user || isOrganizer;
  // Pricing visible to: public visitors and hotel users only. Hidden for organizers & admins.
  const showPricing = !user || isHotel;
  // For Hotels page visible to: public visitors and hotel users only. Hidden for organizers & admins.
  const showForHotels = !user || (isHotel && !isAdmin && !isOrganizer);
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
      } catch {}
      window.location.replace("/");
    }
  };

  const navLinks = (
    <>
      <Link to="/how-it-works" className="text-sm font-medium text-foreground/80 hover:text-foreground transition">{t("nav.howItWorks")}</Link>
      <Link to="/hotels" className="text-sm font-medium text-foreground/80 hover:text-foreground transition">{t("nav.hotels")}</Link>
      {showForHotels && (
        <Link to="/for-hotels" className="text-sm font-medium text-foreground/80 hover:text-foreground transition">{t("nav.forHotels")}</Link>
      )}
      {showPricing && (
        <Link to="/pricing" className="text-sm font-medium text-foreground/80 hover:text-foreground transition">{t("nav.pricing")}</Link>
      )}
      <Link to="/about" className="text-sm font-medium text-foreground/80 hover:text-foreground transition">{t("nav.about")}</Link>
      <Link to="/contact" className="text-sm font-medium text-foreground/80 hover:text-foreground transition">{t("nav.contact")}</Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container-page flex h-16 items-center gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-gold">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">{t("brand")}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">{navLinks}</nav>

        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/dashboard">{t("nav.dashboard")}</Link></Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>{t("nav.signOut")}</Button>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/auth">{t("nav.signIn")}</Link>
            </Button>
          )}
          {showQuoteCta && (
            <Button asChild variant="gold" size="sm" className="hidden sm:inline-flex">
              <Link to="/request-quote">{t("nav.getQuote")}</Link>
            </Button>
          )}
          <button className="md:hidden p-2" onClick={() => setOpen(v => !v)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container-page py-4 flex flex-col gap-3" onClick={() => setOpen(false)}>
            {navLinks}
            {!user && <Link to="/auth" className="text-sm font-medium">{t("nav.signIn")}</Link>}
            {showQuoteCta && <Button asChild variant="gold" size="sm" className="w-full"><Link to="/request-quote">{t("nav.getQuote")}</Link></Button>}
          </div>
        </div>
      )}
    </header>
  );
}
