import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mt-24 border-t border-border bg-primary text-primary-foreground">
      <div className="container-page py-12 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold text-primary"><Building2 className="h-5 w-5" /></span>
            <span className="font-display text-xl font-semibold">{t("brand")}</span>
          </div>
          <p className="mt-3 text-sm text-primary-foreground/70 max-w-xs">{t("tagline")}</p>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-gold">{t("footer.platform")}</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/how-it-works">{t("nav.howItWorks")}</Link></li>
            <li><Link to="/hotels">{t("nav.hotels")}</Link></li>
            <li><Link to="/pricing">{t("nav.pricing")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-gold">{t("footer.company")}</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/about">{t("nav.about")}</Link></li>
            <li><Link to="/contact">{t("nav.contact")}</Link></li>
            <li><Link to="/for-hotels">{t("nav.forHotels")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-gold">{t("footer.legal")}</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li>{t("footer.privacy")}</li>
            <li>{t("footer.terms")}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10">
        <div className="container-page py-4 text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} {t("brand")}. {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}
