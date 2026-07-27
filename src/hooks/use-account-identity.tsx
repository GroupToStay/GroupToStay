import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useRoles } from "@/hooks/use-role";
import { getUserAvatarUrl } from "@/lib/account-identity";

export function useAccountIdentity() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { adminRole, isAdmin, isHotel, loading: rolesLoading } = useRoles();
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const role = isAdmin ? (adminRole ?? "admin") : isHotel ? "hotel" : "agency";
  const displayName =
    profile?.full_name ||
    profile?.legal_company_name ||
    profile?.company_name ||
    profile?.org_name ||
    user?.email?.split("@")[0] ||
    t("common.brand.name");

  return {
    avatarUrl: getUserAvatarUrl(user?.user_metadata),
    displayName,
    isLoading: rolesLoading || profileLoading,
    profile,
    role,
    user,
  };
}
