"use client";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock3, Handshake, Hotel, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import { dealActivationEnabled } from "@/features/deals/deal-activation-config";
import {
  loadMyNegotiations,
  negotiationListQueryKey,
} from "@/features/deals/deal-activation-service";
import {
  classifyDealWorkspaceError,
  getNegotiationAttention,
} from "@/features/deals/deal-workspace-model";
import { useAuth } from "@/hooks/use-auth";
import { useApplicationLocale } from "@/lib/application-locale";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/negotiations")({
  head: () => ({ meta: [{ title: i18n.t("deals:activation.list.metaTitle") }] }),
  component: NegotiationsPage,
});

export function NegotiationsPage() {
  const { t } = useTranslation("deals");
  const { user } = useAuth();
  const { formatNumber, formatDateTime } = useApplicationLocale();
  const negotiations = useQuery({
    queryKey: negotiationListQueryKey(user?.id),
    queryFn: () => loadMyNegotiations(user!.id),
    enabled: dealActivationEnabled && Boolean(user),
    retry: false,
  });

  if (!dealActivationEnabled) {
    return (
      <EmptyState
        icon={Handshake}
        title={t("activation.unavailable.title")}
        description={t("activation.unavailable.description")}
        secondaryLabel={t("workspace.back")}
        secondaryTo="/dashboard"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Handshake}
        title={t("activation.list.title")}
        description={t("activation.list.description")}
      />

      {negotiations.isLoading ? (
        <div className="space-y-3" role="status" aria-live="polite">
          <span className="sr-only">{t("activation.list.loading")}</span>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : negotiations.error ? (
        <EmptyState
          icon={Handshake}
          title={t("activation.list.errorTitle")}
          description={t(`activation.errors.${classifyDealWorkspaceError(negotiations.error)}`)}
          actionLabel={t("workspace.actions.retry")}
          onAction={() => negotiations.refetch()}
        />
      ) : negotiations.data?.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title={t("activation.list.emptyTitle")}
          description={t("activation.list.emptyDescription")}
        />
      ) : (
        <div className="space-y-3">
          {negotiations.data?.map((item) => {
            const attention = getNegotiationAttention(item.deal, item.latestOffer, item.actor);
            const lastActivity = item.latestOffer?.created_at ?? item.deal.updated_at;
            return (
              <Card key={item.deal.id} className="overflow-hidden">
                <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-foreground">
                        {item.sourceRfq?.title ?? t("activation.list.requestFallback")}
                      </h2>
                      <StatusBadge status={item.deal.status} />
                      <Badge variant="outline" className="rounded-full">
                        {t(`activation.attention.${attention}`)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      {item.sourceHotel ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Hotel className="h-4 w-4" aria-hidden="true" />
                          {item.sourceHotel.name}
                        </span>
                      ) : null}
                      {item.sourceRfq ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          {item.sourceRfq.destination_city}, {item.sourceRfq.destination_country}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-4 w-4" aria-hidden="true" />
                        {t("activation.list.lastActivity", {
                          date: formatDateTime(lastActivity),
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                    <div className="min-w-0 text-start sm:me-auto lg:me-0 lg:text-end">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("activation.list.latestOffer")}
                      </p>
                      <p className="mt-1 font-display text-xl text-primary" dir="ltr">
                        {item.latestOffer
                          ? formatNumber(item.latestOffer.amount, {
                              style: "currency",
                              currency: item.latestOffer.currency,
                              currencyDisplay: "code",
                              maximumFractionDigits: 2,
                            })
                          : t("activation.list.awaitingOffer")}
                      </p>
                    </div>
                    <Button asChild variant="gold" className="min-h-11 w-full sm:w-auto">
                      <Link to="/deals/$dealId" params={{ dealId: item.deal.id }}>
                        {t("activation.actions.open")}
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
