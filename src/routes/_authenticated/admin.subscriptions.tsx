import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions — Admin" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <CreditCard className="h-7 w-7" /> Subscriptions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Billing and active plan management.</p>
      </header>
      <Card>
        <CardContent className="p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-2xl text-primary">Coming Soon</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            The subscription billing module will be available once the payment system is launched.
          </p>
          <Badge className="mt-4 bg-muted text-muted-foreground uppercase tracking-wide">
            Not Active Yet
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
