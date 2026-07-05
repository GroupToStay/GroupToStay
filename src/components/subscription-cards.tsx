import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from "lucide-react";
import { WaitlistModal } from "@/components/waitlist-modal";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

type PlanKey = "professional" | "featured";

const PLANS: Record<
  PlanKey,
  { titleKey: string; priceKey: string; featuresKey: string; featured?: boolean }
> = {
  professional: {
    titleKey: "pricing.subscriptions.professionalTitle",
    priceKey: "pricing.subscriptions.professionalPrice",
    featuresKey: "pricing.subscriptions.professionalFeatures",
  },
  featured: {
    titleKey: "pricing.subscriptions.featuredTitle",
    priceKey: "pricing.subscriptions.featuredPrice",
    featuresKey: "pricing.subscriptions.featuredFeatures",
    featured: true,
  },
};

export function SubscriptionCards() {
  const { t } = useTranslation();
  const [waitlistPlan, setWaitlistPlan] = useState<PlanKey | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-display text-xl text-primary">
          {t("pricing.subscriptions.upgradeTitle")}
        </h2>
        <Badge className="bg-gold/15 text-gold border border-gold/30">
          {t("pricing.subscriptions.paymentLaunchingSoon")}
        </Badge>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {(Object.keys(PLANS) as PlanKey[]).map((k) => {
          const p = PLANS[k];
          const features = t(p.featuresKey, { returnObjects: true }) as string[];
          return (
            <Card key={k} className={p.featured ? "border-gold shadow-[var(--shadow-gold)]" : ""}>
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-center gap-2">
                  {p.featured && <Sparkles className="h-4 w-4 text-gold" />}
                  <div className="font-display text-lg text-primary">{t(p.titleKey)}</div>
                </div>
                <div className="font-display text-3xl text-primary mt-2">{t(p.priceKey)}</div>
                <ul className="mt-4 space-y-2 text-sm flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-col gap-2">
                  <Button asChild variant={p.featured ? "gold" : "default"} disabled>
                    <Link to="/subscription/coming-soon" search={{ plan: k }}>
                      {t("pricing.subscriptions.badge")}
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => setWaitlistPlan(k)}>
                    {t("pricing.subscriptions.notifyMe")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <WaitlistModal
        open={waitlistPlan !== null}
        onOpenChange={(o) => !o && setWaitlistPlan(null)}
        plan={waitlistPlan ?? "professional"}
      />
    </div>
  );
}
