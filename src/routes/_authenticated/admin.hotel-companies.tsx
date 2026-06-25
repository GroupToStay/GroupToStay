import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { CompaniesPanel } from "./dashboard.admin";

export const Route = createFileRoute("/_authenticated/admin/hotel-companies")({
  head: () => ({ meta: [{ title: "Hotel Companies — Admin" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Building2 className="h-7 w-7" /> Hotel Companies
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Approve, reject and review hotel company applications.</p>
      </header>
      <CompaniesPanel />
    </div>
  );
}
