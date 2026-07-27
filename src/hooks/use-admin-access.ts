import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_PERMISSION_KEYS,
  EMPTY_ADMIN_ACCESS,
  parseAdminAccess,
  type AdminAccess,
  type AdminPermission,
} from "@/lib/admin-permissions";

async function legacyAdminFallback(userId: string): Promise<AdminAccess> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return data
    ? {
        accessLevel: 100,
        isAdmin: true,
        permissions: [...ADMIN_PERMISSION_KEYS],
        role: "super_admin",
        roleName: null,
      }
    : EMPTY_ADMIN_ACCESS;
}

export function useAdminAccess() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["my-admin-access", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_admin_access");
      if (error) return legacyAdminFallback(user!.id);
      return parseAdminAccess(data);
    },
  });

  const access = query.data ?? EMPTY_ADMIN_ACCESS;
  return {
    ...query,
    access,
    hasPermission: (permission: AdminPermission) => access.permissions.includes(permission),
    isAdmin: access.isAdmin,
  };
}
