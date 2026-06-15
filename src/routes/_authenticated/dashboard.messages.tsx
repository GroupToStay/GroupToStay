import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/messages")({
  head: () => ({ meta: [{ title: "Messages — GroupToStay" }] }),
  component: () => <Outlet />,
});
