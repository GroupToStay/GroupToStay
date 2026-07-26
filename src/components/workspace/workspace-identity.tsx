import { AccountAvatar } from "@/components/account-avatar";
import { RoleBadge } from "@/components/role-badge";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useRoles } from "@/hooks/use-role";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

export function WorkspaceIdentity({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, isHotel, loading: rolesLoading } = useRoles();
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const role = isAdmin ? "admin" : isHotel ? "hotel" : "agency";
  const displayName =
    profile?.full_name ||
    profile?.legal_company_name ||
    profile?.company_name ||
    profile?.org_name ||
    user?.email?.split("@")[0] ||
    t("common.brand.name");
  const imageUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined);

  if (compact) {
    return <AccountAvatar name={displayName} imageUrl={imageUrl} className="h-9 w-9" />;
  }

  if (rolesLoading || profileLoading) {
    return (
      <div className="flex min-w-0 items-center gap-3" aria-hidden="true">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <AccountAvatar name={displayName} imageUrl={imageUrl} className="h-10 w-10" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">{displayName}</div>
        <RoleBadge role={role} compact className="mt-1" />
      </div>
    </div>
  );
}
