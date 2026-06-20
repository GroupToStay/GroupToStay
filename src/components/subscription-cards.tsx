import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from "lucide-react";
import { WaitlistModal } from "@/components/waitlist-modal";
import { Link } from "@tanstack/react-router";

type PlanKey = "professional" | "featured";

const PLANS: Record<PlanKey, { title: string; price: string; features: string[]; featured?: boolean }> = {
  professional: {
    title: "Professional Hotel",
    price: "SAR 199/month",
    features: [
      "Priority Group Requests",
      "Analytics Dashboard",
      "Enhanced Profile",
      "Extra Images",
      "Priority Support",
    ],
  },
  featured: {
    title: "Featured Hotel",
    price: "SAR 399/month",
    featured: true,
    features: [
      "Featured Badge",
      "Homepage Placement",
      "Search Priority",
      "Destination Placement",
      "Premium Support",
    ],
  },
};

export function SubscriptionCards() {
  const [waitlistPlan, setWaitlistPlan] = useState<PlanKey | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-display text-xl text-primary">Upgrade Your Hotel</h2>
        <Badge className="bg-gold/15 text-gold border border-gold/30">Payment Services Launching Soon</Badge>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {(Object.keys(PLANS) as PlanKey[]).map(k => {
          const p = PLANS[k];
          return (
            <Card key={k} className={p.featured ? "border-gold shadow-[var(--shadow-gold)]" : ""}>
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-center gap-2">
                  {p.featured && <Sparkles className="h-4 w-4 text-gold" />}
                  <div className="font-display text-lg text-primary">{p.title}</div>
                </div>
                <div className="font-display text-3xl text-primary mt-2">{p.price}</div>
                <ul className="mt-4 space-y-2 text-sm flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-col gap-2">
                  <Button asChild variant={p.featured ? "gold" : "default"} disabled>
                    <Link to="/subscription/coming-soon" search={{ plan: k }}>Coming Soon</Link>
                  </Button>
                  <Button variant="outline" onClick={() => setWaitlistPlan(k)}>Notify Me</Button>
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
