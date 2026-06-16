import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-4 font-display text-2xl text-primary">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {message ?? "You don't have permission to view this page."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/dashboard" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Go to dashboard
          </Link>
          <Link to="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
