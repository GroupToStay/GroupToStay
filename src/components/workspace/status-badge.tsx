import { useTranslation } from "react-i18next";
import {
  Award,
  Ban,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock3,
  Eye,
  Send,
  XCircle,
  Handshake,
  History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  accepted: { icon: CheckCircle2, className: "border-success/20 bg-success/10 text-success" },
  active: { icon: CheckCircle2, className: "border-success/20 bg-success/10 text-success" },
  agreed: { icon: Handshake, className: "border-gold/30 bg-gold/10 text-gold-foreground" },
  approved: { icon: CheckCircle2, className: "border-success/20 bg-success/10 text-success" },
  awarded: { icon: Award, className: "border-gold/30 bg-gold/10 text-gold-foreground" },
  cancelled: { icon: Ban, className: "border-error/20 bg-error/10 text-error" },
  closed: { icon: Circle, className: "border-border bg-muted text-muted-foreground" },
  completed: { icon: CheckCircle2, className: "border-success/20 bg-success/10 text-success" },
  confirmed: { icon: CheckCircle2, className: "border-success/20 bg-success/10 text-success" },
  declined: { icon: XCircle, className: "border-error/20 bg-error/10 text-error" },
  disabled: { icon: Ban, className: "border-error/20 bg-error/10 text-error" },
  draft: { icon: CircleDashed, className: "border-border bg-muted text-muted-foreground" },
  expired: { icon: Clock3, className: "border-border bg-muted text-muted-foreground" },
  open: { icon: CheckCircle2, className: "border-success/20 bg-success/10 text-success" },
  pending: { icon: Clock3, className: "border-warning/20 bg-warning/10 text-warning" },
  pending_review: { icon: Clock3, className: "border-warning/20 bg-warning/10 text-warning" },
  quoting: { icon: Send, className: "border-info/20 bg-info/10 text-info" },
  rejected: { icon: XCircle, className: "border-error/20 bg-error/10 text-error" },
  shortlisted: { icon: Award, className: "border-gold/30 bg-gold/10 text-gold-foreground" },
  submitted: { icon: Send, className: "border-info/20 bg-info/10 text-info" },
  superseded: { icon: History, className: "border-border bg-muted text-muted-foreground" },
  suspended: { icon: Ban, className: "border-error/20 bg-error/10 text-error" },
  verified: { icon: CheckCircle2, className: "border-success/20 bg-success/10 text-success" },
  viewed: { icon: Eye, className: "border-info/20 bg-info/10 text-info" },
  withdrawn: { icon: Ban, className: "border-border bg-muted text-muted-foreground" },
} as const;

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const { t } = useTranslation();
  const normalized = String(status ?? "unknown").toLowerCase();
  const config = statusConfig[normalized as keyof typeof statusConfig] ?? {
    icon: Circle,
    className: "border-border bg-muted text-muted-foreground",
  };
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {t(`dashboard.status.${normalized}`, {
        defaultValue: t(`status.${normalized}`, { defaultValue: normalized }),
      })}
    </Badge>
  );
}
