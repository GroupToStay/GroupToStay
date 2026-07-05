import { createFileRoute, Outlet } from "@tanstack/react-router";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: i18n.t("dashboard.meta.title") }] }),
  component: () => <Outlet />,
});
