import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { InterestPanel } from "./dashboard.admin";

export const Route = createFileRoute("/_authenticated/admin/subscription-interest")({
  head: () => ({ meta: [{ title: i18n.t("admin.subscriptionInterest.metaTitle") }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Inbox className="h-7 w-7" /> {t("admin.subscriptionInterest.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.subscriptionInterest.description")}
        </p>
      </header>
      <InterestPanel />
    </div>
  );
}
