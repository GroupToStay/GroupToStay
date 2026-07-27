import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useAdminAccess } from "@/hooks/use-admin-access";

export type AppRole = "organizer" | "hotel" | "admin";

export function useRoles() {
  const { user } = useAuth();
  const adminAccess = useAdminAccess();
  const q = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
  const roles = q.data ?? [];
  const isAdmin = roles.includes("admin") || adminAccess.isAdmin;
  return {
    adminRole: adminAccess.access.role,
    permissions: adminAccess.access.permissions,
    roles,
    isHotel: !isAdmin && roles.includes("hotel"),
    isAdmin,
    isOrganizer: !isAdmin && (roles.includes("organizer") || roles.length === 0),
    loading: q.isLoading || adminAccess.isLoading,
  };
}
