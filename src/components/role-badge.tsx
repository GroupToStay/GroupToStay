import { BadgeCheck, Building2, Hotel, ShieldCheck, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  isAdminDisplayRole,
  isSuperAdminDisplayRole,
  normalizeDisplayRole,
} from "@/lib/account-identity";
import { cn } from "@/lib/utils";

export function RoleBadge({
  role,
  compact = false,
  className,
}: {
  role?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const normalized = normalizeDisplayRole(role);
  const config = isAdminDisplayRole(normalized)
    ? {
        label: isSuperAdminDisplayRole(normalized) ? t("role.superAdmin") : t("role.admin"),
        Icon: ShieldCheck,
        style: "border-success/25 bg-success/10 text-success",
      }
    : normalized === "agency"
      ? {
          label: t("role.agency"),
          Icon: Building2,
          style: "border-brand-blue/25 bg-brand-blue/10 text-brand-blue",
        }
      : normalized === "hotel"
        ? {
            label: t("role.hotel"),
            Icon: Hotel,
            style: "border-warning/30 bg-warning/10 text-warning",
          }
        : {
            label: t("role.visitor"),
            Icon: UserRound,
            style: "border-border bg-muted text-muted-foreground",
          };

  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        config.style,
        className,
      )}
    >
      {compact ? (
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <config.Icon className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>{config.label}</span>
    </Badge>
  );
}
