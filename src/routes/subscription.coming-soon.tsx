import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Clock } from "lucide-react";
import { WaitlistModal } from "@/components/waitlist-modal";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

type Search = { plan?: "professional" | "featured" };

export const Route = createFileRoute("/subscription/coming-soon")({
  head: () => ({
    meta: [
      { title: i18n.t("pricing.subscriptions.metaTitle") },
      {
        name: "description",
        content: i18n.t("pricing.subscriptions.metaDescription"),
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    plan: s.plan === "professional" || s.plan === "featured" ? s.plan : undefined,
  }),
  component: Page,
});

const PLANS = [
  {
    key: "professional" as const,
    titleKey: "pricing.subscriptions.professionalTitle",
    priceKey: "pricing.subscriptions.professionalPrice",
    featuresKey: "pricing.subscriptions.professionalFeatures",
  },
  {
    key: "featured" as const,
    titleKey: "pricing.subscriptions.featuredTitle",
    priceKey: "pricing.subscriptions.featuredPrice",
    featured: true,
    featuresKey: "pricing.subscriptions.featuredFeatures",
  },
];

function Page() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const [waitlistPlan, setWaitlistPlan] = useState<"professional" | "featured" | null>(
    search.plan ?? null,
  );

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container-page py-16">
        <div className="text-center max-w-2xl mx-auto">
          <Badge className="bg-gold/15 text-gold border border-gold/30">
            <Clock className="h-3 w-3 mr-1" /> {t("pricing.subscriptions.badge")}
          </Badge>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-primary">
            {t("pricing.subscriptions.title")}
          </h1>
          <p className="mt-4 text-muted-foreground">{t("pricing.subscriptions.description")}</p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {PLANS.map((p) => {
            const features = t(p.featuresKey, { returnObjects: true }) as string[];
            return (
              <Card
                key={p.key}
                className={p.featured ? "border-gold shadow-[var(--shadow-gold)]" : ""}
              >
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-center gap-2">
                    {p.featured && <Sparkles className="h-4 w-4 text-gold" />}
                    <div className="font-display text-xl text-primary">{t(p.titleKey)}</div>
                    <Badge className="ml-auto">{t("pricing.subscriptions.badge")}</Badge>
                  </div>
                  <div className="font-display text-4xl text-primary mt-3">{t(p.priceKey)}</div>
                  <ul className="mt-5 space-y-2 text-sm flex-1">
                    {features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="h-4 w-4 text-success mt-0.5 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex flex-col gap-2">
                    <Button variant={p.featured ? "gold" : "default"} disabled>
                      {t("pricing.subscriptions.badge")}
                    </Button>
                    <Button variant="outline" onClick={() => setWaitlistPlan(p.key)}>
                      {t("pricing.subscriptions.notifyMe")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          {t("pricing.subscriptions.launchNote")}
        </p>
      </main>
      <SiteFooter />
      <WaitlistModal
        open={waitlistPlan !== null}
        onOpenChange={(o) => !o && setWaitlistPlan(null)}
        plan={waitlistPlan ?? "professional"}
      />
    </div>
  );
}
