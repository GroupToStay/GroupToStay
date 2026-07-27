import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAdminPermission } from "@/lib/admin-authorization";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => requireAdminPermission(),
  component: () => <Outlet />,
});
