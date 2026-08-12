import { Fragment, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  Circle,
  CircleSlash,
  Clock,
  EllipsisVertical,
  RotateCcw,
  Shield,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useApplicationLocale } from "@/lib/application-locale";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/workspace/page-header";
import { RoleBadge } from "@/components/role-badge";

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "gold" | "purple";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success/15 text-success border-success/20",
  warning: "bg-warning/15 text-warning border-warning/20",
  error: "bg-error/15 text-error border-error/20",
  info: "bg-info/15 text-info border-info/20",
  gold: "bg-gold/20 text-gold-foreground border-gold/30",
  purple: "bg-violet-100 text-violet-700 border-violet-200",
};

export type AdminMetric = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
};

export type AdminActionItem = {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
};

export function AdminManagementPage({
  title,
  description,
  icon: Icon,
  actions,
  metrics,
  children,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  metrics?: AdminMetric[];
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <PageHeader title={title} description={description} icon={Icon} actions={actions} />

      {metrics?.length ? <AdminMetricGrid metrics={metrics} /> : null}
      {children}
    </section>
  );
}

export function AdminMetricGrid({ metrics }: { metrics: AdminMetric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
      {metrics.map((metric) => {
        const Icon = metric.icon ?? Circle;
        const tone = metric.tone ?? "neutral";
        return (
          <Card
            key={String(metric.label)}
            className="overflow-hidden border-border bg-card shadow-sm"
          >
            <CardContent className="flex items-center gap-3 p-4">
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-md border",
                  toneClass[tone],
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">{metric.label}</div>
                <div className="mt-0.5 text-2xl font-semibold leading-none text-foreground tabular-nums">
                  {metric.value}
                </div>
                {metric.description ? (
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {metric.description}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function AdminToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card
      className={cn(
        "sticky top-20 z-20 border-border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        {children}
      </CardContent>
    </Card>
  );
}

export function AdminTableCard({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-border bg-card shadow-sm", className)}>
      <CardContent className="p-0">{children}</CardContent>
      {footer ? <div className="border-t border-border bg-muted/20 px-4 py-3">{footer}</div> : null}
    </Card>
  );
}

export function AdminActionMenu({ items }: { items: AdminActionItem[] }) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <EllipsisVertical className="h-4 w-4" />
          <span className="sr-only">{t("admin.common.openActions")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Fragment key={item.label}>
              {item.separatorBefore ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                disabled={item.disabled}
                onSelect={() => {
                  item.onSelect();
                }}
                className={cn(item.destructive && "text-error focus:text-error")}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {item.label}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminStatusBadge({ status }: { status?: string | null }) {
  const { t } = useTranslation();
  const normalized = String(status || "unknown")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const config = getStatusConfig(normalized);
  const Icon = config.icon;
  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        toneClass[config.tone],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {t(`status.${normalized}`, {
        defaultValue: config.labelKey ? t(config.labelKey) : normalized,
      })}
    </Badge>
  );
}

export function AdminRoleBadge({ role }: { role?: string | null }) {
  return <RoleBadge role={role} />;
}

export function AdminDetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function AdminDetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface/60 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-sm text-foreground">{value || "-"}</div>
    </div>
  );
}

export function AdminPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { t } = useTranslation();
  const { formatNumber } = useApplicationLocale();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);
  const pages = visiblePages(safePage, pageCount);

  return (
    <div className="flex flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
      <div>
        {t("admin.pagination.showing")}{" "}
        <span className="font-medium text-foreground">
          {start}-{end}
        </span>{" "}
        {t("admin.pagination.of")}{" "}
        <span className="font-medium text-foreground">{formatNumber(total)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs">{t("admin.pagination.rowsPerPage")}</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="h-8 w-[82px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[25, 50, 100].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          {t("admin.pagination.previous")}
        </Button>
        {pages.map((item, index) =>
          item === "dots" ? (
            <span key={`dots-${index}`} className="px-1">
              ...
            </span>
          ) : (
            <Button
              key={item}
              variant={item === safePage ? "default" : "outline"}
              size="sm"
              className="h-8 min-w-8 px-2"
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={safePage >= pageCount}
          onClick={() => onPageChange(safePage + 1)}
        >
          {t("admin.pagination.next")}
        </Button>
      </div>
    </div>
  );
}

function getStatusConfig(status: string): { tone: Tone; icon: LucideIcon; labelKey?: string } {
  if (["approved", "verified", "active", "open", "awarded", "success"].includes(status))
    return { tone: "success", icon: CheckCircle2 };
  if (
    [
      "submitted",
      "pending",
      "pending_review",
      "quoting",
      "under_review",
      "draft",
      "waiting",
    ].includes(status)
  )
    return { tone: "warning", icon: Clock };
  if (["rejected", "cancelled", "suspended", "disabled", "expired", "error"].includes(status))
    return { tone: "error", icon: XCircle };
  if (["closed", "locked", "archived", "notified"].includes(status))
    return { tone: "neutral", icon: CircleSlash };
  if (["trusted", "premium"].includes(status)) return { tone: "gold", icon: BadgeCheck };
  if (["unverified", "not_required", "unknown"].includes(status))
    return { tone: "neutral", icon: Shield, labelKey: `status.${status}` };
  if (status === "reconsider") return { tone: "info", icon: RotateCcw };
  if (status === "blocked") return { tone: "error", icon: Ban };
  return { tone: "neutral", icon: Circle };
}

function visiblePages(page: number, pageCount: number): Array<number | "dots"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((item) => item >= 1 && item <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "dots"> = [];
  sorted.forEach((item, index) => {
    const previous = sorted[index - 1];
    if (previous && item - previous > 1) result.push("dots");
    result.push(item);
  });
  return result;
}
