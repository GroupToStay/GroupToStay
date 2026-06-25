import { createFileRoute } from "@tanstack/react-router";
import { Hotel } from "lucide-react";
import { HotelsPanel } from "./dashboard.admin";

export const Route = createFileRoute("/_authenticated/admin/hotel-listings")({
  head: () => ({ meta: [{ title: "Hotel Listings — Admin" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Hotel className="h-7 w-7" /> Hotel Listings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Approve, suspend and review individual hotel properties.</p>
      </header>
      <HotelsPanel />
    </div>
  );
}
