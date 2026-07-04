import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

export function AccessDenied({
  title = "Access denied",
  message = "This area is restricted. GroupToStay is a B2B RFQ marketplace — hotel directory browsing is available to administrators only.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center">
        <div className="container-page py-24 max-w-xl text-center">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl text-primary">403 — {title}</h1>
          <p className="mt-3 text-muted-foreground">{message}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link to="/">Return home</Link>
            </Button>
            <Button asChild variant="gold">
              <Link to="/request-quote">Create a group request</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
