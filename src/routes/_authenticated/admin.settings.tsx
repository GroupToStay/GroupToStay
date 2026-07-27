import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAdminPermission } from "@/lib/admin-authorization";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  beforeLoad: async () => {
    await requireAdminPermission("manage_settings");
    throw redirect({ to: "/settings", search: { tab: "profile" } });
  },
  component: () => null,
});
