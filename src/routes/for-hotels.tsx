import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/for-hotels")({
  head: () => ({
    meta: [
      { title: "For hotels — GroupToStay" },
      { name: "description", content: "List your hotel and receive pre-qualified group RFQs. Pay only when you win." },
      { property: "og:title", content: "Win more group business with GroupToStay" },
    ],
  }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground">
          <div className="container-page py-20">
            <h1 className="font-display text-4xl md:text-5xl">{t("forHotels.title")}</h1>
            <p className="mt-3 text-primary-foreground/80 max-w-2xl">{t("forHotels.subtitle")}</p>
            <Button asChild variant="hero" size="lg" className="mt-6"><Link to="/contact">{t("forHotels.ctaList")}</Link></Button>
          </div>
        </section>
        <section className="container-page py-16 grid md:grid-cols-3 gap-6">
          {[1,2,3].map(n => (
            <Card key={n}><CardContent className="p-6">
              <CheckCircle2 className="h-6 w-6 text-gold" />
              <h3 className="mt-3 font-display text-xl text-primary">{t(`forHotels.benefit${n}Title`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`forHotels.benefit${n}Body`)}</p>
            </CardContent></Card>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
