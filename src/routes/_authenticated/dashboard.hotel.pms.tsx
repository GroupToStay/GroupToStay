"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Server } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/hotel/pms")({
  head: () => ({ meta: [{ title: i18n.t("hotelDash.pms.metaTitle") }] }),
  component: Page,
});

export function Page() {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={t("hotelDash.pms.title")}
        description={t("hotelDash.pms.description")}
        icon={Server}
      />
      <EmptyState
        icon={Server}
        title={t("hotelDash.pms.notConnected")}
        description={t("hotelDash.pms.futureAvailability")}
      >
        <p className="text-xs text-muted-foreground">{t("hotelDash.pms.profileHint")}</p>
      </EmptyState>
    </div>
  );
}
