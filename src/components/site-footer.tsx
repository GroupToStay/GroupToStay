import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Building2, Mail, MapPin } from "lucide-react";

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="mt-auto border-t border-border bg-primary text-primary-foreground">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.25fr_0.8fr_0.9fr_0.8fr] lg:py-14">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-gold text-gold-foreground">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="font-display text-xl font-semibold">{t("common.brand.name")}</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-6 text-primary-foreground/70">
            {t("footer.description")}
          </p>
          <a
            href="mailto:support@grouptostay.com"
            className="mt-5 inline-flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-gold"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            support@grouptostay.com
          </a>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-gold">{t("footer.quickLinks")}</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li>
              <Link to="/how-it-works" className="hover:text-gold">
                {t("nav.howItWorks")}
              </Link>
            </li>
            <li>
              <Link to="/for-hotels" className="hover:text-gold">
                {t("nav.forHotels")}
              </Link>
            </li>
            <li>
              <Link to="/pricing" className="hover:text-gold">
                {t("nav.pricing")}
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-gold">
                {t("nav.about")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-gold">{t("footer.contact")}</h4>
          <ul className="space-y-3 text-sm text-primary-foreground/80">
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-gold" aria-hidden="true" />
              support@grouptostay.com
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-gold" aria-hidden="true" />
              {t("footer.location")}
            </li>
            <li>
              <Link to="/contact" className="underline-offset-2 hover:text-gold hover:underline">
                {t("nav.contact")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-gold">{t("footer.legal")}</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li>
              <Link to="/trust" className="hover:text-gold">
                {t("legal.trust.title")}
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-gold">
                {t("legal.terms.title")}
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-gold">
                {t("legal.privacy.title")}
              </Link>
            </li>
            <li>
              <Link to="/cookies" className="hover:text-gold">
                {t("legal.cookies.title")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-primary-foreground/60">
          <span>
            {t("footer.copyright", {
              year: new Date().getFullYear(),
              brand: t("common.brand.name"),
            })}
          </span>
          <span>{t("footer.madeFor")}</span>
        </div>
      </div>
    </footer>
  );
}
