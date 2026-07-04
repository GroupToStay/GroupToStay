import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Organizer-only routes — admins and hotel users are redirected away.
export const Route = createFileRoute("/_authenticated/dashboard/rfqs")({
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const list = (roles ?? []).map((r) => r.role);
    if (list.includes("admin") || list.includes("hotel")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => <Outlet />,
});
