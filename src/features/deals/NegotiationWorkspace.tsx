import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  Handshake,
  History,
  Hotel,
  LockKeyhole,
  ShieldCheck,
  Tag,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { useApplicationLocale } from "@/lib/application-locale";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import { WorkspaceSection } from "@/components/workspace/section";
import {
  classifyDealWorkspaceError,
  getDealActions,
  getOfferActions,
  selectCommercialOffer,
  type DealWorkspaceAction,
  type DealWorkspaceErrorKind,
  type DealWorkspaceSnapshot,
  type OfferRow,
} from "@/features/deals/deal-workspace-model";
import {
  dealWorkspaceQueryKey,
  executeDealWorkspaceAction,
  loadDealWorkspace,
} from "@/features/deals/deal-workspace-service";

export function NegotiationWorkspace({ dealId }: { dealId: string }) {
  const { t } = useTranslation("deals");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { formatDate, formatDateTime, formatNumber } = useApplicationLocale();
  const [announcement, setAnnouncement] = useState("");

  const workspaceQuery = useQuery({
    queryKey: dealWorkspaceQueryKey(dealId, user?.id),
    enabled: Boolean(user),
    queryFn: () => loadDealWorkspace(dealId, user!.id),
    retry: (failureCount, error) =>
      classifyDealWorkspaceError(error) === "network" && failureCount < 1,
    staleTime: 10_000,
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, targetId }: { action: DealWorkspaceAction; targetId: string }) =>
      executeDealWorkspaceAction(action, targetId),
    onMutate: () => setAnnouncement(""),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: dealWorkspaceQueryKey(dealId, user?.id) });
      const message = t(`workspace.feedback.${variables.action}`);
      setAnnouncement(message);
      toast.success(message);
    },
    onError: async (error) => {
      const kind = classifyDealWorkspaceError(error);
      const message = t(`workspace.errors.${kind}`);
      if (kind === "stale" || kind === "state_changed") {
        await queryClient.invalidateQueries({ queryKey: dealWorkspaceQueryKey(dealId, user?.id) });
      }
      setAnnouncement(message);
      toast.error(message);
    },
  });

  async function runAction(action: DealWorkspaceAction, targetId: string) {
    try {
      await actionMutation.mutateAsync({ action, targetId });
      return true;
    } catch {
      return false;
    }
  }

  if (!user || workspaceQuery.isLoading) return <WorkspaceLoading />;
  if (workspaceQuery.error) {
    return (
      <WorkspaceError
        kind={classifyDealWorkspaceError(workspaceQuery.error)}
        onRetry={() => workspaceQuery.refetch()}
      />
    );
  }
  if (!workspaceQuery.data) return <WorkspaceUnavailable />;

  const snapshot = workspaceQuery.data;
  const commercialOffer = selectCommercialOffer(snapshot.offers);
  const dealActions = getDealActions(snapshot.deal, snapshot.actor);

  return (
    <div className="space-y-7 pb-8">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <PageHeader
        icon={Handshake}
        eyebrow={
          <Link
            to="/dashboard"
            className="inline-flex min-h-11 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            {t("workspace.back")}
          </Link>
        }
        title={snapshot.sourceRfq?.title ?? t("workspace.title")}
        description={workspaceDescription(snapshot, t)}
        meta={
          <>
            <StatusBadge status={snapshot.deal.status} />
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t(`workspace.actor.${snapshot.actor.side}`)}
            </Badge>
          </>
        }
        actions={dealActions.map((action) => (
          <CommandConfirmation
            key={action}
            action={action}
            pending={actionMutation.isPending}
            onConfirm={() => runAction(action, snapshot.deal.id)}
          />
        ))}
      />

      <CommercialSummary
        snapshot={snapshot}
        offer={commercialOffer}
        formatDate={formatDate}
        formatNumber={formatNumber}
      />

      <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.65fr)]">
        <WorkspaceSection
          title={t("workspace.offers.title")}
          description={t("workspace.offers.description")}
        >
          {snapshot.offers.length === 0 ? (
            <EmptyState
              icon={History}
              title={t("workspace.offers.emptyTitle")}
              description={t("workspace.offers.emptyDescription")}
            />
          ) : (
            <div className="space-y-4" aria-label={t("workspace.offers.historyLabel")}>
              {snapshot.offers.map((offer, index) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  position={snapshot.offers.length - index}
                  deal={snapshot}
                  pending={actionMutation.isPending}
                  formatDateTime={formatDateTime}
                  formatNumber={formatNumber}
                  onAction={runAction}
                />
              ))}
            </div>
          )}
        </WorkspaceSection>

        <aside className="space-y-6" aria-label={t("workspace.context.title")}>
          <ContextPanel snapshot={snapshot} formatDate={formatDate} />
          <Alert className="border-primary/15 bg-primary/5">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{t("workspace.privacy.title")}</AlertTitle>
            <AlertDescription>{t("workspace.privacy.description")}</AlertDescription>
          </Alert>
        </aside>
      </div>
    </div>
  );
}

function workspaceDescription(
  snapshot: DealWorkspaceSnapshot,
  t: ReturnType<typeof useTranslation<"deals">>["t"],
) {
  const destination = [
    snapshot.sourceRfq?.destination_city,
    snapshot.sourceRfq?.destination_country,
  ]
    .filter(Boolean)
    .join(", ");
  return destination || snapshot.sourceHotel?.name || t("workspace.description");
}

function CommercialSummary({
  snapshot,
  offer,
  formatDate,
  formatNumber,
}: {
  snapshot: DealWorkspaceSnapshot;
  offer: OfferRow | null;
  formatDate: (value: Date | string | number) => string;
  formatNumber: (value: number | string, options?: Intl.NumberFormatOptions) => string;
}) {
  const { t } = useTranslation("deals");
  const rfq = snapshot.sourceRfq;
  const formattedAmount = offer
    ? formatNumber(offer.amount, {
        style: "currency",
        currency: offer.currency,
        currencyDisplay: "code",
        maximumFractionDigits: 2,
      })
    : t("workspace.summary.awaitingOffer");

  return (
    <section aria-labelledby="commercial-summary-title">
      <h2 id="commercial-summary-title" className="sr-only">
        {t("workspace.summary.title")}
      </h2>
      <dl className="grid overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem
          icon={Tag}
          label={t("workspace.summary.currentValue")}
          value={<bdi dir="ltr">{formattedAmount}</bdi>}
          emphasized
        />
        <SummaryItem
          icon={CalendarDays}
          label={t("workspace.summary.dates")}
          value={
            rfq?.check_in && rfq?.check_out
              ? `${formatDate(rfq.check_in)} - ${formatDate(rfq.check_out)}`
              : t("workspace.notAvailable")
          }
        />
        <SummaryItem
          icon={Users}
          label={t("workspace.summary.group")}
          value={
            rfq
              ? t("workspace.summary.groupValue", {
                  guests: rfq.guests_count,
                  rooms: rfq.rooms_needed,
                })
              : t("workspace.notAvailable")
          }
        />
        <SummaryItem
          icon={Building2}
          label={t("workspace.summary.property")}
          value={snapshot.sourceHotel?.name ?? t("workspace.participants.maskedSupplier")}
        />
      </dl>
    </section>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
  emphasized = false,
}: {
  icon: typeof Tag;
  label: string;
  value: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className="min-w-0 border-b border-border p-4 last:border-b-0 sm:border-e sm:[&:nth-child(2)]:border-e-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:[&:nth-child(2)]:border-e lg:last:border-e-0">
      <dt className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </dt>
      <dd
        className={cn(
          "mt-2 break-words text-sm font-medium text-foreground",
          emphasized && "text-xl font-semibold tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function OfferCard({
  offer,
  position,
  deal,
  pending,
  formatDateTime,
  formatNumber,
  onAction,
}: {
  offer: OfferRow;
  position: number;
  deal: DealWorkspaceSnapshot;
  pending: boolean;
  formatDateTime: (value: Date | string | number) => string;
  formatNumber: (value: number | string, options?: Intl.NumberFormatOptions) => string;
  onAction: (action: DealWorkspaceAction, targetId: string) => Promise<boolean>;
}) {
  const { t } = useTranslation("deals");
  const actions = getOfferActions(deal.deal, offer, deal.actor);
  const accepted = offer.status === "accepted";
  const amount = formatNumber(offer.amount, {
    style: "currency",
    currency: offer.currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  });

  return (
    <article aria-labelledby={`offer-${position}-title`}>
      <Card
        className={cn(
          "overflow-hidden transition-colors",
          accepted && "border-success/40 bg-success/[0.03] ring-1 ring-success/15",
        )}
      >
        <CardContent className="p-0">
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id={`offer-${position}-title`} className="font-semibold text-foreground">
                    {t("workspace.offers.offerNumber", { number: position })}
                  </h3>
                  <StatusBadge status={offer.status} />
                  {accepted ? (
                    <Badge className="gap-1 rounded-full bg-success text-white hover:bg-success">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("workspace.offers.selected")}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  <time dateTime={offer.created_at}>{formatDateTime(offer.created_at)}</time>
                </p>
              </div>
              <div className="text-start sm:text-end">
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  <bdi dir="ltr">{amount}</bdi>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {offer.valid_until
                    ? t("workspace.offers.validUntil", {
                        date: formatDateTime(offer.valid_until),
                      })
                    : t("workspace.offers.noExpiry")}
                </p>
              </div>
            </div>

            {offer.notes ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                {offer.notes}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("workspace.offers.noNotes")}</p>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                {t("workspace.offers.immutable")}
              </p>
              {actions.length > 0 ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  {actions.map((action) => (
                    <CommandConfirmation
                      key={action}
                      action={action}
                      amount={amount}
                      pending={pending}
                      onConfirm={() => onAction(action, offer.id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}

function ContextPanel({
  snapshot,
  formatDate,
}: {
  snapshot: DealWorkspaceSnapshot;
  formatDate: (value: Date | string | number) => string;
}) {
  const { t } = useTranslation("deals");
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 className="font-semibold text-foreground">{t("workspace.context.title")}</h2>
      <dl className="mt-4 space-y-4 text-sm">
        <ContextRow
          icon={Users}
          label={t("workspace.context.yourRole")}
          value={t(`workspace.actor.${snapshot.actor.side}`)}
        />
        <ContextRow
          icon={Hotel}
          label={t("workspace.context.supplier")}
          value={snapshot.sourceHotel?.name ?? t("workspace.participants.maskedSupplier")}
        />
        <ContextRow
          icon={CalendarDays}
          label={t("workspace.context.created")}
          value={formatDate(snapshot.deal.created_at)}
        />
        <ContextRow
          icon={History}
          label={t("workspace.context.offers")}
          value={t("workspace.context.offerCount", { count: snapshot.offers.length })}
        />
      </dl>
    </section>
  );
}

function ContextRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

const commandIcons = {
  accept: Handshake,
  reject: X,
  withdraw: ArrowLeft,
  expire: Clock3,
  cancel: X,
  close: Check,
} satisfies Record<DealWorkspaceAction, typeof Handshake>;

function CommandConfirmation({
  action,
  amount,
  pending,
  onConfirm,
}: {
  action: DealWorkspaceAction;
  amount?: string;
  pending: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  const { t } = useTranslation("deals");
  const [open, setOpen] = useState(false);
  const Icon = commandIcons[action];
  const destructive = action === "cancel" || action === "reject" || action === "withdraw";

  async function confirm(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (await onConfirm()) setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={action === "accept" ? "gold" : destructive ? "outline" : "default"}
          className={cn("min-h-11 min-w-0 sm:min-w-28", destructive && "text-error")}
          disabled={pending}
          aria-label={t(`workspace.actions.${action}`)}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {t(`workspace.actions.${action}`)}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-2rem)]">
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`workspace.confirm.${action}.title`)}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {amount ? (
                <p className="text-lg font-semibold text-foreground">
                  <bdi dir="ltr">{amount}</bdi>
                </p>
              ) : null}
              <p>{t(`workspace.confirm.${action}.description`)}</p>
              {action === "accept" ? (
                <p className="rounded-md border border-warning/20 bg-warning/10 p-3 text-foreground">
                  {t("workspace.confirm.accept.competitors")}
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={pending}>
            {t("workspace.actions.keepReviewing")}
          </AlertDialogCancel>
          <AlertDialogAction className="min-h-11" disabled={pending} onClick={confirm}>
            {pending ? t("workspace.actions.processing") : t(`workspace.actions.${action}`)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function WorkspaceLoading() {
  const { t } = useTranslation("deals");
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">{t("workspace.loading")}</span>
      <div className="h-28 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
    </div>
  );
}

function WorkspaceUnavailable() {
  const { t } = useTranslation("deals");
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

function WorkspaceError({ kind, onRetry }: { kind: DealWorkspaceErrorKind; onRetry: () => void }) {
  const { t } = useTranslation("deals");
  const backendUnavailable = kind === "backend_unavailable";
  return (
    <EmptyState
      icon={backendUnavailable ? Clock3 : AlertTriangle}
      title={t(`workspace.errorState.${kind}.title`)}
      description={t(`workspace.errorState.${kind}.description`)}
      actionLabel={backendUnavailable ? undefined : t("workspace.actions.retry")}
      onAction={backendUnavailable ? undefined : onRetry}
      secondaryLabel={t("workspace.back")}
      secondaryTo="/dashboard"
    />
  );
}
