import { createFileRoute, Outlet } from "@tanstack/react-router";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/messages")({
  head: () => ({ meta: [{ title: i18n.t("dashboard.messages.metaTitle") }] }),
  component: () => <Outlet />,
});
