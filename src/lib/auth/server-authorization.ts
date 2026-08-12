import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import {
  ADMIN_PERMISSION_KEYS,
  parseAdminAccess,
  type AdminPermission,
} from "@/lib/admin-permissions";
import { canUseMarketplaceRoute } from "@/lib/auth/route-policy";

export const getAuthenticatedUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  return user;
}

export const getCurrentRoles = cache(async () => {
  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).map(({ role }) => role);
});

export async function requireMarketplaceRole(role: "hotel" | "organizer") {
  const roles = await getCurrentRoles();
  if (!canUseMarketplaceRoute(roles, role)) redirect("/dashboard");
}

export async function requireMarketplaceParticipant() {
  const roles = await getCurrentRoles();
  if (!canUseMarketplaceRoute(roles, "participant")) redirect("/dashboard");
}

export async function requireAdminPermission(permission?: AdminPermission) {
  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_admin_access");

  if (!error) {
    const access = parseAdminAccess(data);
    if (access.isAdmin && (!permission || access.permissions.includes(permission))) return access;
    redirect("/dashboard");
  }

  const { data: legacyAdmin } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!legacyAdmin) redirect("/dashboard");

  return {
    accessLevel: 100,
    isAdmin: true,
    permissions: [...ADMIN_PERMISSION_KEYS],
    role: "super_admin" as const,
    roleName: null,
  };
}
