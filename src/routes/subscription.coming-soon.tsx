import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Clock } from "lucide-react";
import { WaitlistModal } from "@/components/waitlist-modal";

type Search = { plan?: "professional" | "featured" };

export const Route = createFileRoute("/subscription/coming-soon")({
  head: () => ({
    meta: [
      { title: "Subscription Plans Coming Soon — GroupToStay" },
      { name: "description", content: "Hotel subscription plans are launching soon. Join the waitlist to be notified." },
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
    title: "Professional Hotel",
    price: "SAR 199/month",
    features: ["Priority Group Requests","Analytics Dashboard","Enhanced Profile","Extra Images","Priority Support"],
  },
  {
    key: "featured" as const,
    title: "Featured Hotel",
    price: "SAR 399/month",
    featured: true,
    features: ["Featured Badge","Homepage Placement","Search Priority","Destination Placement","Premium Support"],
  },
];

function Page() {
  const search = Route.useSearch();
  const [waitlistPlan, setWaitlistPlan] = useState<"professional" | "featured" | null>(search.plan ?? null);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container-page py-16">
        <div className="text-center max-w-2xl mx-auto">
          <Badge className="bg-gold/15 text-gold border border-gold/30">
            <Clock className="h-3 w-3 mr-1" /> Coming Soon
          </Badge>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-primary">Subscription Plans Coming Soon</h1>
          <p className="mt-4 text-muted-foreground">
            We are currently preparing secure online payment services. Hotel subscription plans will be available soon.
            Join the waiting list and we will notify you immediately when subscriptions become available.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {PLANS.map(p => (
            <Card key={p.key} className={p.featured ? "border-gold shadow-[var(--shadow-gold)]" : ""}>
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center gap-2">
                  {p.featured && <Sparkles className="h-4 w-4 text-gold" />}
                  <div className="font-display text-xl text-primary">{p.title}</div>
                  <Badge className="ml-auto">Coming Soon</Badge>
                </div>
                <div className="font-display text-4xl text-primary mt-3">{p.price}</div>
                <ul className="mt-5 space-y-2 text-sm flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-col gap-2">
                  <Button variant={p.featured ? "gold" : "default"} disabled>Coming Soon</Button>
                  <Button variant="outline" onClick={() => setWaitlistPlan(p.key)}>Notify Me</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Estimated launch: very soon. We'll email you the moment payments go live.
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
