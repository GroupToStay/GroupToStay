import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export type QuickAction = {
  id: string;
  label: string;
  description?: string;
  to: string;
  icon: LucideIcon;
};

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.id}
          to={action.to as any}
          className="group flex min-h-20 items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/25 hover:bg-muted/20"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/5 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <action.icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {action.label}
            </span>
            {action.description ? (
              <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                {action.description}
              </span>
            ) : null}
          </span>
        </Link>
      ))}
    </div>
  );
}
