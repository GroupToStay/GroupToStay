import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricTone = "neutral" | "primary" | "gold" | "success" | "warning" | "info";

const toneClasses: Record<MetricTone, string> = {
  neutral: "border-border bg-surface text-foreground",
  primary: "border-primary/10 bg-primary/5 text-primary",
  gold: "border-gold/25 bg-gold/10 text-gold-foreground",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/10 text-warning",
  info: "border-info/20 bg-info/10 text-info",
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  description,
  trend,
  tone = "neutral",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  icon: LucideIcon;
  description?: ReactNode;
  trend?: { direction: "up" | "down"; label: ReactNode };
  tone?: MetricTone;
  className?: string;
}) {
  const TrendIcon = trend?.direction === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <div
      className={cn(
        "flex min-h-32 flex-col justify-between rounded-lg border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-md border",
            toneClasses[tone],
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none text-foreground tabular-nums">
            {value}
          </div>
          {description ? (
            <div className="mt-1.5 truncate text-xs text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {trend ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {trend.label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function MetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>
  );
}
