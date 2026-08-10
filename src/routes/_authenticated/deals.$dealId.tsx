import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "@/components/empty-state";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isDealId } from "@/features/deals/deal-workspace-model";
import { NegotiationWorkspace } from "@/features/deals/NegotiationWorkspace";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/deals/$dealId")({
  head: () => ({ meta: [{ title: i18n.t("deals:workspace.metaTitle") }] }),
  component: DealWorkspaceRoute,
});

function DealWorkspaceRoute() {
  const { dealId } = Route.useParams();
  const { t } = useTranslation("deals");

  if (!isDealId(dealId)) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={t("workspace.unavailable.title")}
        description={t("workspace.unavailable.description")}
        secondaryLabel={t("workspace.back")}
        secondaryTo="/dashboard"
      />
    );
  }

  return <NegotiationWorkspace dealId={dealId} />;
}
