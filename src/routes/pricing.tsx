import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — GroupToStay" },
      { name: "description", content: "Free for organizers. Hotels pay only when they win business." },
    ],
  }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const plans = [
    { key: "organizer", featured: false, cta: "/request-quote", ctaLabel: t("nav.getQuote"), items: ["Unlimited RFQs", "Compare quotes", "Direct messaging"] },
    { key: "hotelBasic", featured: true, cta: "/for-hotels", ctaLabel: t("forHotels.ctaList"), items: ["Free listing", "Matched RFQs", "10% on awarded bookings"] },
    { key: "hotelPremium", featured: false, cta: "/contact", ctaLabel: t("nav.contact"), items: ["Top placement", "Featured badge", "Priority support"] },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container-page py-16 flex-1">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="font-display text-4xl md:text-5xl text-primary">{t("pricing.title")}</h1>
          <p className="mt-3 text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {plans.map(p => (
            <Card key={p.key} className={p.featured ? "border-gold shadow-[var(--shadow-gold)]" : ""}>
              <CardContent className="p-6 flex flex-col h-full">
                <div className="text-sm font-medium text-muted-foreground">{t(`pricing.${p.key}`)}</div>
                <div className="font-display text-4xl text-primary mt-2">{t(`pricing.${p.key}Price`)}</div>
                <p className="mt-3 text-sm text-muted-foreground">{t(`pricing.${p.key}Desc`)}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.items.map(i => <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-success mt-0.5" /> {i}</li>)}
                </ul>
                <Button asChild className="mt-6" variant={p.featured ? "gold" : "default"}><Link to={p.cta}>{p.ctaLabel}</Link></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
