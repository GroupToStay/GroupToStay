import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/hotel/pms")({
  head: () => ({ meta: [{ title: "PMS Integration — GroupToStay" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Server className="h-7 w-7" /> PMS Integration
        </h1>
        <p className="mt-1 text-muted-foreground">Property Management System synchronization.</p>
      </div>
      <Card>
        <CardContent className="p-6 space-y-3">
          <Badge className="bg-muted text-muted-foreground">Not Connected</Badge>
          <p className="text-sm text-muted-foreground">
            PMS synchronization will become available in a future release.
          </p>
          <p className="text-xs text-muted-foreground">
            You can already share your PMS details on your profile so we can prepare your
            integration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
