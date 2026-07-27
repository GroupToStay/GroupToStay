import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { InterestPanel } from "./dashboard.admin";
import { PageHeader } from "@/components/workspace/page-header";
import { requireAdminPermission } from "@/lib/admin-authorization";

export const Route = createFileRoute("/_authenticated/admin/subscription-interest")({
  beforeLoad: () => requireAdminPermission("manage_subscriptions"),
  head: () => ({ meta: [{ title: i18n.t("admin.subscriptionInterest.metaTitle") }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.subscriptionInterest.title")}
        description={t("admin.subscriptionInterest.description")}
        icon={Inbox}
      />
      <InterestPanel />
    </div>
  );
}
