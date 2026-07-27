import { AccountAvatar } from "@/components/account-avatar";
import { RoleBadge } from "@/components/role-badge";
import { useAccountIdentity } from "@/hooks/use-account-identity";
import { Skeleton } from "@/components/ui/skeleton";

export function WorkspaceIdentity({ compact = false }: { compact?: boolean }) {
  const { avatarUrl, displayName, isLoading, role } = useAccountIdentity();

  if (compact) {
    return <AccountAvatar name={displayName} imageUrl={avatarUrl} className="h-9 w-9" />;
  }

  if (isLoading) {
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
      <AccountAvatar name={displayName} imageUrl={avatarUrl} className="h-10 w-10" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">{displayName}</div>
        <RoleBadge role={role} compact className="mt-1" />
      </div>
    </div>
  );
}
