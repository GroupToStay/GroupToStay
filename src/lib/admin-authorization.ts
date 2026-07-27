import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { parseAdminAccess, type AdminPermission } from "@/lib/admin-permissions";

export async function requireAdminPermission(permission?: AdminPermission) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw redirect({ to: "/auth" });

  const { data, error } = await supabase.rpc("get_my_admin_access");
  if (!error) {
    const access = parseAdminAccess(data);
    if (access.isAdmin && (!permission || access.permissions.includes(permission))) {
      return access;
    }
    throw redirect({ to: "/dashboard" });
  }

  // Migration-order fallback preserves access for existing legacy admins.
  const { data: legacyAdmin } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!legacyAdmin) throw redirect({ to: "/dashboard" });
  return null;
}
