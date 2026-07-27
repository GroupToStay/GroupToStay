import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import { requireAdminPermission } from "@/lib/admin-authorization";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  beforeLoad: () => requireAdminPermission("manage_subscriptions"),
  head: () => ({ meta: [{ title: i18n.t("admin.subscriptions.metaTitle") }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.subscriptions.title")}
        description={t("admin.subscriptions.description")}
        icon={CreditCard}
      />
      <EmptyState
        icon={Lock}
        title={t("admin.subscriptions.empty.title")}
        description={t("admin.subscriptions.empty.description")}
      >
        <span className="text-xs font-semibold text-muted-foreground">
          {t("admin.subscriptions.empty.status")}
        </span>
      </EmptyState>
    </div>
  );
}
