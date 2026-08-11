import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  Handshake,
  History,
  Hotel,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Tag,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { useApplicationLocale } from "@/lib/application-locale";
import { cn } from "@/lib/utils";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import { WorkspaceSection } from "@/components/workspace/section";
import {
  classifyDealWorkspaceError,
  canSubmitInitialOffer,
  getOfferSubmittingSide,
  getDealActions,
  getOfferActions,
  groupOfferHistory,
  isLatestOfferVersion,
  selectCommercialOffer,
  type DealWorkspaceAction,
  type DealWorkspaceErrorKind,
  type DealWorkspaceSnapshot,
  type OfferRow,
} from "@/features/deals/deal-workspace-model";
import {
  dealWorkspaceQueryKey,
  executeDealWorkspaceAction,
  executeCounterOffer,
  executeInitialOffer,
  loadDealWorkspace,
  type CounterOfferInput,
  type InitialOfferInput,
} from "@/features/deals/deal-workspace-service";
import { DealChatPanel } from "@/features/deals/DealChatPanel";
import { DealContactPanel } from "@/features/deals/DealContactPanel";
import { InitialOfferDialog } from "@/features/deals/InitialOfferDialog";

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

  const counterMutation = useMutation({
    mutationFn: (input: CounterOfferInput) => executeCounterOffer(input),
    onMutate: () => setAnnouncement(""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dealWorkspaceQueryKey(dealId, user?.id) });
      const message = t("workspace.feedback.counter");
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

  const initialOfferMutation = useMutation({
    mutationFn: (input: InitialOfferInput) => executeInitialOffer(input),
    onMutate: () => setAnnouncement(""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dealWorkspaceQueryKey(dealId, user?.id) });
      const message = t("workspace.feedback.initialOffer");
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

  async function submitCounter(input: CounterOfferInput) {
    try {
      await counterMutation.mutateAsync(input);
      return true;
    } catch {
      return false;
    }
  }

  async function submitInitialOffer(input: InitialOfferInput) {
    try {
      await initialOfferMutation.mutateAsync(input);
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
  const offerThreads = groupOfferHistory(snapshot.offers);

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
        <Tabs defaultValue="offers" className="min-w-0">
          <TabsList className="mb-4 grid h-auto min-h-11 w-full grid-cols-2 p-1">
            <TabsTrigger value="offers" className="min-h-11 gap-2">
              <History className="h-4 w-4" aria-hidden="true" />
              {t("workspace.tabs.offers")}
            </TabsTrigger>
            <TabsTrigger value="chat" className="min-h-11 gap-2">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              {t("workspace.tabs.chat")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="offers" className="mt-0">
            <WorkspaceSection
              title={t("workspace.offers.title")}
              description={t("workspace.offers.description")}
            >
              {snapshot.offers.length === 0 ? (
                <EmptyState
                  icon={History}
                  title={t("workspace.offers.emptyTitle")}
                  description={t("workspace.offers.emptyDescription")}
                >
                  {canSubmitInitialOffer(snapshot) ? (
                    <InitialOfferDialog
                      dealId={snapshot.deal.id}
                      defaultCurrency={snapshot.sourceRfq?.currency ?? "SAR"}
                      pending={initialOfferMutation.isPending}
                      onSubmit={submitInitialOffer}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("workspace.initialOffer.waiting")}
                    </p>
                  )}
                </EmptyState>
              ) : (
                <div className="space-y-6" aria-label={t("workspace.offers.historyLabel")}>
                  {offerThreads.map((thread, threadIndex) => (
                    <section
                      key={thread.id}
                      className="space-y-3"
                      aria-labelledby={`offer-thread-${threadIndex + 1}`}
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                        <h3
                          id={`offer-thread-${threadIndex + 1}`}
                          className="text-sm font-semibold text-foreground"
                        >
                          {t("workspace.offers.threadNumber", { number: threadIndex + 1 })}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {t("workspace.offers.versionCount", { count: thread.offers.length })}
                        </span>
                      </div>
                      <ol className="relative space-y-3 border-s border-border ps-4 sm:ps-5">
                        {thread.offers.map((offer) => (
                          <li key={offer.id} className="relative">
                            <span
                              className="absolute -start-[1.31rem] top-6 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground sm:-start-[1.56rem]"
                              aria-hidden="true"
                            />
                            <OfferCard
                              offer={offer}
                              deal={snapshot}
                              pending={
                                actionMutation.isPending ||
                                counterMutation.isPending ||
                                initialOfferMutation.isPending
                              }
                              formatDateTime={formatDateTime}
                              formatNumber={formatNumber}
                              onAction={runAction}
                              onCounter={submitCounter}
                            />
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
            </WorkspaceSection>
          </TabsContent>

          <TabsContent value="chat" className="mt-0">
            <DealChatPanel snapshot={snapshot} />
          </TabsContent>
        </Tabs>

        <aside className="space-y-6" aria-label={t("workspace.context.title")}>
          <ContextPanel snapshot={snapshot} formatDate={formatDate} />
          <DealContactPanel snapshot={snapshot} />
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
  deal,
  pending,
  formatDateTime,
  formatNumber,
  onAction,
  onCounter,
}: {
  offer: OfferRow;
  deal: DealWorkspaceSnapshot;
  pending: boolean;
  formatDateTime: (value: Date | string | number) => string;
  formatNumber: (value: number | string, options?: Intl.NumberFormatOptions) => string;
  onAction: (action: DealWorkspaceAction, targetId: string) => Promise<boolean>;
  onCounter: (input: CounterOfferInput) => Promise<boolean>;
}) {
  const { t } = useTranslation("deals");
  const actions = getOfferActions(deal.deal, offer, deal.actor, new Date(), deal.offers);
  const accepted = offer.status === "accepted";
  const latest = isLatestOfferVersion(offer, deal.offers);
  const submittingSide = getOfferSubmittingSide(deal.deal, offer);
  const amount = formatNumber(offer.amount, {
    style: "currency",
    currency: offer.currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  });

  return (
    <article aria-labelledby={`offer-${offer.id}-title`}>
      <Card
        className={cn(
          "overflow-hidden transition-colors",
          accepted && "border-success/40 bg-success/[0.03] ring-1 ring-success/15",
          offer.status === "superseded" && "bg-muted/25",
          latest && offer.status === "submitted" && "border-primary/35 ring-1 ring-primary/10",
        )}
      >
        <CardContent className="p-0">
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 id={`offer-${offer.id}-title`} className="font-semibold text-foreground">
                    {t("workspace.offers.versionNumber", { number: offer.version_number })}
                  </h4>
                  {submittingSide ? (
                    <Badge variant="outline" className="rounded-full">
                      {t(`workspace.offers.submittedBy.${submittingSide}`)}
                    </Badge>
                  ) : null}
                  {latest && offer.status === "submitted" ? (
                    <Badge variant="secondary" className="rounded-full">
                      {t("workspace.offers.current")}
                    </Badge>
                  ) : null}
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
                  {actions.map((action) =>
                    action === "counter" ? (
                      <CounterOfferDialog
                        key={action}
                        offer={offer}
                        amount={amount}
                        submittingSide={submittingSide}
                        pending={pending}
                        onSubmit={onCounter}
                      />
                    ) : (
                      <CommandConfirmation
                        key={action}
                        action={action}
                        amount={amount}
                        versionNumber={offer.version_number}
                        submittingSide={submittingSide}
                        pending={pending}
                        onConfirm={() => onAction(action, offer.id)}
                      />
                    ),
                  )}
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

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function CounterOfferDialog({
  offer,
  amount: formattedAmount,
  submittingSide,
  pending,
  onSubmit,
}: {
  offer: OfferRow;
  amount: string;
  submittingSide: "buyer" | "supplier" | null;
  pending: boolean;
  onSubmit: (input: CounterOfferInput) => Promise<boolean>;
}) {
  const { t } = useTranslation("deals");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(offer.amount));
  const [currency, setCurrency] = useState(offer.currency);
  const [validUntil, setValidUntil] = useState(toDateTimeLocalValue(offer.valid_until));
  const [notes, setNotes] = useState(offer.notes ?? "");
  const [formError, setFormError] = useState("");

  function resetForm() {
    setAmount(String(offer.amount));
    setCurrency(offer.currency);
    setValidUntil(toDateTimeLocalValue(offer.valid_until));
    setNotes(offer.notes ?? "");
    setFormError("");
  }

  function changeOpen(next: boolean) {
    if (pending) return;
    if (next) resetForm();
    setOpen(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const parsedAmount = Number(amount);
    const normalizedCurrency = currency.trim().toUpperCase();
    const parsedValidity = validUntil ? new Date(validUntil) : null;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError(t("workspace.counter.errors.amount"));
      return;
    }
    if (!/^[A-Z]{3}$/u.test(normalizedCurrency)) {
      setFormError(t("workspace.counter.errors.currency"));
      return;
    }
    if (
      parsedValidity &&
      (!Number.isFinite(parsedValidity.getTime()) || parsedValidity <= new Date())
    ) {
      setFormError(t("workspace.counter.errors.validity"));
      return;
    }
    if (notes.trim().length > 5000) {
      setFormError(t("workspace.counter.errors.notes"));
      return;
    }

    setFormError("");
    const succeeded = await onSubmit({
      parentOfferId: offer.id,
      amount: parsedAmount,
      currency: normalizedCurrency,
      validUntil: parsedValidity?.toISOString() ?? null,
      notes: notes.trim() || null,
    });
    if (succeeded) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="gold"
          className="min-h-11 min-w-0 sm:min-w-32"
          disabled={pending}
        >
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
          {t("workspace.actions.counter")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {t("workspace.counter.title", { number: offer.version_number + 1 })}
            </DialogTitle>
            <DialogDescription>{t("workspace.counter.description")}</DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium text-foreground">{t("workspace.counter.previous")}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                <bdi dir="ltr" className="font-semibold text-foreground">
                  {formattedAmount}
                </bdi>
                <span aria-hidden="true">·</span>
                <span>{t(`workspace.offers.submittedBy.${submittingSide ?? "unknown"}`)}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("workspace.counter.historyNotice")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`counter-amount-${offer.id}`}>
                  {t("workspace.counter.amount")}
                </Label>
                <Input
                  id={`counter-amount-${offer.id}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={pending}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`counter-currency-${offer.id}`}>
                  {t("workspace.counter.currency")}
                </Label>
                <Input
                  id={`counter-currency-${offer.id}`}
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                  maxLength={3}
                  autoCapitalize="characters"
                  dir="ltr"
                  disabled={pending}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`counter-validity-${offer.id}`}>
                {t("workspace.counter.validUntil")}
              </Label>
              <Input
                id={`counter-validity-${offer.id}`}
                type="datetime-local"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
                disabled={pending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`counter-notes-${offer.id}`}>{t("workspace.counter.notes")}</Label>
              <Textarea
                id={`counter-notes-${offer.id}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={5000}
                rows={4}
                disabled={pending}
              />
            </div>

            {formError ? (
              <p className="text-sm font-medium text-error" role="alert">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-11" disabled={pending}>
                {t("workspace.actions.keepReviewing")}
              </Button>
            </DialogClose>
            <Button type="submit" variant="gold" className="min-h-11" disabled={pending}>
              <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
              {pending ? t("workspace.actions.processing") : t("workspace.actions.submitCounter")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  versionNumber,
  submittingSide,
  pending,
  onConfirm,
}: {
  action: DealWorkspaceAction;
  amount?: string;
  versionNumber?: number;
  submittingSide?: "buyer" | "supplier" | null;
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
                <div className="space-y-1">
                  {versionNumber ? (
                    <p className="text-sm font-medium text-foreground">
                      {t("workspace.offers.versionNumber", { number: versionNumber })}
                      {submittingSide
                        ? ` · ${t(`workspace.offers.submittedBy.${submittingSide}`)}`
                        : ""}
                    </p>
                  ) : null}
                  <p className="text-lg font-semibold text-foreground">
                    <bdi dir="ltr">{amount}</bdi>
                  </p>
                </div>
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
