import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type AppRole = "organizer" | "hotel" | "admin";

export function useRoles() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map(r => r.role as AppRole);
    },
  });
  const roles = q.data ?? [];
  return {
    roles,
    isHotel: roles.includes("hotel"),
    isAdmin: roles.includes("admin"),
    isOrganizer: roles.includes("organizer") || roles.length === 0,
    loading: q.isLoading,
  };
}
