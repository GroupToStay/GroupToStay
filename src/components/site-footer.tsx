import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Building2, Mail, Phone, MapPin, Twitter, Facebook, Instagram, Linkedin } from "lucide-react";
import { useRoles } from "@/hooks/use-role";

export function SiteFooter() {
  const { t } = useTranslation();
  const { isOrganizer } = useRoles();
  return (
    <footer className="mt-auto border-t border-border bg-primary text-primary-foreground">
      <div className="container-page py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        {/* Company */}
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-premium text-premium-foreground"><Building2 className="h-5 w-5" /></span>
            <span className="font-display text-xl font-semibold">{t("brand")}</span>
          </div>
          <p className="mt-3 text-sm text-primary-foreground/70 max-w-xs">
            The B2B group accommodation marketplace. One request — competing hotel quotations.
          </p>
          <div className="mt-5 flex items-center gap-2">
            {[
              { icon: Twitter, href: "#", label: "Twitter" },
              { icon: Facebook, href: "#", label: "Facebook" },
              { icon: Instagram, href: "#", label: "Instagram" },
              { icon: Linkedin, href: "#", label: "LinkedIn" },
            ].map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="grid h-9 w-9 place-items-center rounded-md bg-primary-foreground/10 hover:bg-premium hover:text-premium-foreground transition"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <h4 className="font-semibold mb-3 text-premium">Quick Links</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/how-it-works" className="hover:text-premium">{t("nav.howItWorks")}</Link></li>
            <li><Link to="/hotels" className="hover:text-premium">{t("nav.hotels")}</Link></li>
            <li><Link to="/requests" className="hover:text-premium">{t("hero.ctaBrowseRequests")}</Link></li>
            <li><Link to="/for-hotels" className="hover:text-premium">{t("nav.forHotels")}</Link></li>
            <li><Link to="/pricing" className="hover:text-premium">{t("nav.pricing")}</Link></li>
            <li><Link to="/about" className="hover:text-premium">{t("nav.about")}</Link></li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-semibold mb-3 text-premium">Contact</h4>
          <ul className="space-y-3 text-sm text-primary-foreground/80">
            <li className="flex items-start gap-2"><Mail className="h-4 w-4 mt-0.5 text-premium" /> support@grouptostay.com</li>
            <li className="flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 text-premium" /> +966 11 000 0000</li>
            <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-premium" /> Riyadh, Saudi Arabia</li>
            <li><Link to="/contact" className="hover:text-premium underline-offset-2 hover:underline">{t("nav.contact")}</Link></li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="font-semibold mb-3 text-premium">Legal</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/trust" className="hover:text-premium">Trust &amp; Security</Link></li>
            <li><Link to="/about" className="hover:text-premium">Terms &amp; Conditions</Link></li>
            <li><Link to="/about" className="hover:text-premium">Privacy Policy</Link></li>
            <li><Link to="/about" className="hover:text-premium">Cookie Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10">
        <div className="container-page py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-primary-foreground/60">
          <span>© {new Date().getFullYear()} {t("brand")}. {t("footer.rights")}</span>
          <span>Made for group hospitality.</span>
        </div>
      </div>
    </footer>
  );
}
