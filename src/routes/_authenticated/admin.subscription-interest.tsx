import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { InterestPanel } from "./dashboard.admin";

export const Route = createFileRoute("/_authenticated/admin/subscription-interest")({
  head: () => ({ meta: [{ title: "Subscription Interest — Admin" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Inbox className="h-7 w-7" /> Subscription Interest
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hotels who joined the waitlist for premium plans.
        </p>
      </header>
      <InterestPanel />
    </div>
  );
}
