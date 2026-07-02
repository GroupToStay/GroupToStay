import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings - Admin" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Settings className="h-7 w-7" /> Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin account and platform settings.</p>
      </header>

      <Card>
        <CardContent className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-medium text-primary">
              <ShieldCheck className="h-4 w-4" /> Admin Profile Settings
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage the current admin profile, contact details and account email from the existing profile settings workflow.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard/profile">Open Profile Settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
