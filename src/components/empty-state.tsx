import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryTo?: string;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  secondaryLabel,
  secondaryTo,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/60 px-6 py-12 text-center " +
        (className ?? "")
      }
    >
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-md border border-primary/10 bg-primary/5 text-primary">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-4 w-full max-w-md">{children}</div> : null}
      {(actionLabel || secondaryLabel) && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {actionLabel ? (
            actionTo ? (
              <Button asChild>
                <Link to={actionTo}>{actionLabel}</Link>
              </Button>
            ) : (
              <Button onClick={onAction}>{actionLabel}</Button>
            )
          ) : null}
          {secondaryLabel && secondaryTo ? (
            <Button asChild variant="outline">
              <Link to={secondaryTo}>{secondaryLabel}</Link>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
