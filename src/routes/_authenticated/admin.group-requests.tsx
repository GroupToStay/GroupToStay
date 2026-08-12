"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import {
  Calendar,
  Eye,
  FileText,
  Hotel,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AdminActionMenu,
  AdminDetailGrid,
  AdminDetailItem,
  AdminManagementPage,
  AdminPagination,
  AdminStatusBadge,
  AdminTableCard,
  AdminToolbar,
  type AdminMetric,
} from "@/components/admin/management-ui";
import {
  formatAdminDate,
  formatCompactNumber,
  getPageSlice,
} from "@/components/admin/management-utils";
import { EmptyState } from "@/components/empty-state";
import { HOTEL_CATEGORY_TRANSLATION_KEYS, type HotelCategory } from "@/features/rfq/rfq-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/integrations/supabase/types";
import { useApplicationLocale } from "@/lib/application-locale";
import i18n from "@/lib/i18n";
import { requireAdminPermission } from "@/lib/admin-authorization";

export const Route = createFileRoute("/_authenticated/admin/group-requests")({
  beforeLoad: () => requireAdminPermission("manage_rfqs"),
  head: () => ({ meta: [{ title: i18n.t("admin.groupRequests.metaTitle") }] }),
  component: Page,
});

type Rfq = Database["public"]["Tables"]["rfqs"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Quote = Pick<
  Database["public"]["Tables"]["quotes"]["Row"],
  "id" | "rfq_id" | "hotel_id" | "status" | "total_price" | "currency" | "created_at" | "updated_at"
>;
type RfqStatus = Database["public"]["Enums"]["rfq_status"];
type StatusFilter = "all" | "pending" | "open" | "closed" | "cancelled" | "expired";
type SortKey = "newest" | "oldest" | "guests" | "destination";
const ANY_HOTEL_CATEGORY = "Any";
type DialogState =
  | { type: "request"; row: AdminRfq }
  | { type: "quotes"; row: AdminRfq }
  | { type: "agency"; row: AdminRfq }
  | null;

type AdminRfq = Rfq & {
  agency?: Profile;
  quotations: Quote[];
  quotationCount: number;
};

const statusFilterKeys: { value: StatusFilter; labelKey: string }[] = [
  { value: "all", labelKey: "admin.groupRequests.filters.allStatus" },
  { value: "pending", labelKey: "status.pending" },
  { value: "open", labelKey: "status.open" },
  { value: "closed", labelKey: "status.closed" },
  { value: "cancelled", labelKey: "status.cancelled" },
  { value: "expired", labelKey: "status.expired" },
];

const sortOptionKeys: { value: SortKey; labelKey: string }[] = [
  { value: "newest", labelKey: "admin.groupRequests.sort.newest" },
  { value: "oldest", labelKey: "admin.groupRequests.sort.oldest" },
  { value: "guests", labelKey: "admin.groupRequests.sort.guests" },
  { value: "destination", labelKey: "admin.groupRequests.sort.destination" },
];

export function Page() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { compare, language } = useApplicationLocale();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-rfq-management"],
    queryFn: async () => {
      const { data: rfqs, error: rfqError } = await supabase
        .from("rfqs")
        .select("*")
        .order("created_at", { ascending: false });
      if (rfqError) throw rfqError;

      const rfqRows = rfqs ?? [];
      const rfqIds = rfqRows.map((row) => row.id);
      const agencyIds = [...new Set(rfqRows.map((row) => row.organizer_id))];

      const [quotesResult, profilesResult] = await Promise.all([
        rfqIds.length
          ? supabase
              .from("quotes")
              .select("id,rfq_id,hotel_id,status,total_price,currency,created_at,updated_at")
              .in("rfq_id", rfqIds)
          : Promise.resolve({ data: [], error: null }),
        agencyIds.length
          ? supabase.from("profiles").select("*").in("id", agencyIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (quotesResult.error) throw quotesResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const quotesByRfq = new Map<string, Quote[]>();
      (quotesResult.data ?? []).forEach((quote) => {
        const list = quotesByRfq.get(quote.rfq_id) ?? [];
        list.push(quote);
        quotesByRfq.set(quote.rfq_id, list);
      });

      const profileById = new Map(
        (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
      );

      return rfqRows.map((row) => {
        const quotations = quotesByRfq.get(row.id) ?? [];
        return {
          ...row,
          agency: profileById.get(row.organizer_id),
          quotations,
          quotationCount: quotations.length,
        };
      }) satisfies AdminRfq[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RfqStatus }) => {
      const { error } = await supabase.from("rfqs").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.groupRequests.toasts.updated"));
      qc.invalidateQueries({ queryKey: ["admin-rfq-management"] });
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, t("admin.groupRequests.errors.updateFailed"))),
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rfqs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.groupRequests.toasts.deleted"));
      qc.invalidateQueries({ queryKey: ["admin-rfq-management"] });
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, t("admin.groupRequests.errors.deleteFailed"))),
  });

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows
      .filter((row) => matchesStatus(row, statusFilter))
      .filter((row) => {
        if (!text) return true;
        return [
          row.id,
          row.title,
          agencyName(row.agency, t),
          row.destination_country,
          row.destination_city,
        ]
          .join(" ")
          .toLowerCase()
          .includes(text);
      })
      .sort((a, b) => {
        if (sort === "oldest")
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sort === "guests") return b.guests_count - a.guests_count;
        if (sort === "destination")
          return compare(
            `${a.destination_country} ${a.destination_city}`,
            `${b.destination_country} ${b.destination_city}`,
          );
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [compare, query, rows, sort, statusFilter, t]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sort, pageSize]);

  const pageRows = getPageSlice(filteredRows, page, pageSize);
  const counts = useMemo(() => {
    return statusFilterKeys.reduce<Record<StatusFilter, number>>(
      (acc, item) => {
        acc[item.value] =
          item.value === "all"
            ? rows.length
            : rows.filter((row) => matchesStatus(row, item.value)).length;
        return acc;
      },
      {} as Record<StatusFilter, number>,
    );
  }, [rows]);

  const metrics: AdminMetric[] = [
    {
      label: t("admin.groupRequests.metrics.allRequests.label"),
      value: formatCompactNumber(rows.length, language),
      description: t("admin.groupRequests.metrics.allRequests.description"),
      icon: FileText,
      tone: "info",
    },
    {
      label: t("status.pending"),
      value: formatCompactNumber(counts.pending ?? 0, language),
      description: t("admin.groupRequests.metrics.pending.description"),
      icon: Calendar,
      tone: "warning",
    },
    {
      label: t("status.open"),
      value: formatCompactNumber(counts.open ?? 0, language),
      description: t("admin.groupRequests.metrics.open.description"),
      icon: Hotel,
      tone: "success",
    },
    {
      label: t("status.closed"),
      value: formatCompactNumber(counts.closed ?? 0, language),
      description: t("admin.groupRequests.metrics.closed.description"),
      icon: RotateCcw,
      tone: "neutral",
    },
    {
      label: t("status.cancelled"),
      value: formatCompactNumber(counts.cancelled ?? 0, language),
      description: t("admin.groupRequests.metrics.cancelled.description"),
      icon: ShieldAlert,
      tone: "error",
    },
  ];

  return (
    <AdminManagementPage
      title={t("admin.groupRequests.title")}
      description={t("admin.groupRequests.description")}
      icon={FileText}
      metrics={metrics}
    >
      <AdminToolbar>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder={t("admin.groupRequests.searchPlaceholder")}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <SelectTrigger className="w-full lg:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusFilterKeys.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
          <SelectTrigger className="w-full lg:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptionKeys.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => {
            setQuery("");
            setStatusFilter("all");
            setSort("newest");
          }}
        >
          {t("admin.common.resetFilters")}
        </Button>
      </AdminToolbar>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("admin.groupRequests.loading")}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-error">
            {t("admin.groupRequests.errors.loadFailed")}
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("admin.groupRequests.empty.title")}
          description={t("admin.groupRequests.empty.description")}
        />
      ) : (
        <AdminTableCard
          footer={
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={filteredRows.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>{t("admin.groupRequests.table.rfq")}</TableHead>
                  <TableHead>{t("admin.groupRequests.table.agency")}</TableHead>
                  <TableHead>{t("admin.groupRequests.table.destination")}</TableHead>
                  <TableHead>{t("admin.groupRequests.table.guestsRooms")}</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    {t("admin.groupRequests.table.categories")}
                  </TableHead>
                  <TableHead>{t("admin.groupRequests.table.status")}</TableHead>
                  <TableHead>{t("admin.groupRequests.table.quotes")}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("admin.groupRequests.table.updated")}
                  </TableHead>
                  <TableHead className="w-12 text-right">
                    {t("admin.groupRequests.table.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => setDialog({ type: "request", row })}
                  >
                    <TableCell className="min-w-[190px]">
                      <div className="font-medium text-foreground">{row.title}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {shortId(row.id)}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      <div className="font-medium">{agencyName(row.agency, t)}</div>
                      <div className="text-xs text-muted-foreground">
                        {contactEmail(row.agency)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                        {row.destination_city}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.destination_country}</div>
                    </TableCell>
                    <TableCell>
                      <div>
                        {t("admin.groupRequests.table.guestsCount", {
                          count: row.guests_count,
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("admin.groupRequests.table.roomsCount", {
                          count: row.rooms_needed,
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-[220px] xl:table-cell">
                      <CategoryPreview row={row} />
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge status={isExpired(row) ? "expired" : row.status} />
                    </TableCell>
                    <TableCell className="font-medium">{row.quotationCount}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {formatAdminDate(row.updated_at)}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end">
                        <RequestActions
                          row={row}
                          onView={() => setDialog({ type: "request", row })}
                          onQuotes={() => setDialog({ type: "quotes", row })}
                          onAgency={() => setDialog({ type: "agency", row })}
                          onClose={() => updateStatus.mutate({ id: row.id, status: "closed" })}
                          onSuspend={() => updateStatus.mutate({ id: row.id, status: "cancelled" })}
                          onDelete={() => {
                            if (window.confirm(t("admin.groupRequests.confirmDelete")))
                              deleteRequest.mutate(row.id);
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y divide-border md:hidden">
            {pageRows.map((row) => (
              <div key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => setDialog({ type: "request", row })}
                  >
                    <div className="font-medium text-foreground">{row.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">{shortId(row.id)}</div>
                  </button>
                  <RequestActions
                    row={row}
                    onView={() => setDialog({ type: "request", row })}
                    onQuotes={() => setDialog({ type: "quotes", row })}
                    onAgency={() => setDialog({ type: "agency", row })}
                    onClose={() => updateStatus.mutate({ id: row.id, status: "closed" })}
                    onSuspend={() => updateStatus.mutate({ id: row.id, status: "cancelled" })}
                    onDelete={() => {
                      if (window.confirm(t("admin.groupRequests.confirmDelete")))
                        deleteRequest.mutate(row.id);
                    }}
                  />
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t("admin.groupRequests.table.agency")}
                    </span>
                    <span className="text-right">{agencyName(row.agency, t)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t("admin.groupRequests.table.destination")}
                    </span>
                    <span className="text-right">
                      {row.destination_city}, {row.destination_country}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t("admin.groupRequests.table.guestsRooms")}
                    </span>
                    <span>
                      {row.guests_count} / {row.rooms_needed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t("admin.groupRequests.table.status")}
                    </span>
                    <AdminStatusBadge status={isExpired(row) ? "expired" : row.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AdminTableCard>
      )}

      <RfqDialog dialog={dialog} onOpenChange={(open) => !open && setDialog(null)} />
    </AdminManagementPage>
  );
}

function RequestActions({
  row,
  onView,
  onQuotes,
  onAgency,
  onClose,
  onSuspend,
  onDelete,
}: {
  row: AdminRfq;
  onView: () => void;
  onQuotes: () => void;
  onAgency: () => void;
  onClose: () => void;
  onSuspend: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <AdminActionMenu
      items={[
        { label: t("admin.groupRequests.actions.viewRequest"), icon: Eye, onSelect: onView },
        { label: t("admin.groupRequests.actions.viewQuotations"), icon: Hotel, onSelect: onQuotes },
        { label: t("admin.groupRequests.actions.viewAgency"), icon: Users, onSelect: onAgency },
        {
          label: t("admin.groupRequests.actions.closeRequest"),
          icon: RotateCcw,
          onSelect: onClose,
          disabled: row.status === "closed",
        },
        {
          label: t("admin.groupRequests.actions.suspendRequest"),
          icon: ShieldAlert,
          onSelect: onSuspend,
          disabled: row.status === "cancelled",
        },
        {
          label: t("admin.groupRequests.actions.deleteRequest"),
          icon: Trash2,
          onSelect: onDelete,
          destructive: true,
          separatorBefore: true,
        },
      ]}
    />
  );
}

function RfqDialog({
  dialog,
  onOpenChange,
}: {
  dialog: DialogState;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { formatNumber } = useApplicationLocale();
  const row = dialog?.row;
  return (
    <Dialog open={!!dialog} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        {dialog?.type === "request" && row ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {row.title}
                <AdminStatusBadge status={isExpired(row) ? "expired" : row.status} />
              </DialogTitle>
              <DialogDescription>
                {t("admin.groupRequests.dialog.requestId", { id: row.id })}
              </DialogDescription>
            </DialogHeader>
            <AdminDetailGrid>
              <AdminDetailItem
                label={t("admin.groupRequests.table.agency")}
                value={agencyName(row.agency, t)}
              />
              <AdminDetailItem
                label={t("admin.groupRequests.table.destination")}
                value={`${row.destination_country}, ${row.destination_city}`}
              />
              <AdminDetailItem
                label={t("rfq.fields.checkIn")}
                value={formatAdminDate(row.check_in)}
              />
              <AdminDetailItem
                label={t("rfq.fields.checkOut")}
                value={formatAdminDate(row.check_out)}
              />
              <AdminDetailItem label={t("dashboard.guests")} value={row.guests_count} />
              <AdminDetailItem label={t("dashboard.rooms")} value={row.rooms_needed} />
              <AdminDetailItem
                label={t("rfq.fields.accommodation")}
                value={
                  row.accommodation_type
                    ? t(`rfq.accommodationTypes.${row.accommodation_type}`)
                    : t("rfq.accommodationTypes.any")
                }
              />
              <AdminDetailItem
                label={t("rfq.fields.mealPlan")}
                value={mealPlanLabel(row.meal_plan_code || row.board_type, t)}
              />
              <AdminDetailItem
                label={t("admin.groupRequests.table.quotes")}
                value={row.quotationCount}
              />
              <AdminDetailItem
                label={t("admin.groupRequests.details.created")}
                value={formatAdminDate(row.created_at)}
              />
              <AdminDetailItem
                label={t("admin.groupRequests.details.lastUpdate")}
                value={formatAdminDate(row.updated_at)}
              />
              <AdminDetailItem
                label={t("rfq.fields.deadline")}
                value={formatAdminDate(row.deadline)}
              />
            </AdminDetailGrid>
            <div className="rounded-md border border-border bg-surface/60 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("admin.groupRequests.table.categories")}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(row.hotel_categories_v2?.length
                  ? row.hotel_categories_v2
                  : [ANY_HOTEL_CATEGORY]
                ).map((item) => (
                  <Badge key={item} variant="secondary">
                    {categoryLabel(item, t)}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface/60 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("rfq.fields.requirementsOptional")}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {row.requirements ||
                  row.additional_requirements ||
                  row.special_requirements ||
                  t("admin.groupRequests.details.noRequirements")}
              </p>
            </div>
          </>
        ) : null}

        {dialog?.type === "quotes" && row ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("admin.groupRequests.dialog.quotationsTitle", { title: row.title })}
              </DialogTitle>
              <DialogDescription>
                {t("admin.groupRequests.dialog.quotationsReceived", {
                  count: row.quotationCount,
                })}
              </DialogDescription>
            </DialogHeader>
            {row.quotations.length === 0 ? (
              <EmptyState
                icon={Hotel}
                title={t("admin.groupRequests.empty.noQuotationsTitle")}
                description={t("admin.groupRequests.empty.noQuotationsDescription")}
              />
            ) : (
              <div className="space-y-2">
                {row.quotations.map((quote) => (
                  <div
                    key={quote.id}
                    className="rounded-md border border-border bg-surface/60 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">
                        {t("admin.groupRequests.quotes.quoteId", { id: shortId(quote.id) })}
                      </div>
                      <AdminStatusBadge status={quote.status} />
                    </div>
                    <div className="mt-2 text-muted-foreground">
                      {t("admin.groupRequests.quotes.amountSubmitted", {
                        amount: `${quote.currency} ${formatNumber(quote.total_price)}`,
                        date: formatAdminDate(quote.created_at),
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        {dialog?.type === "agency" && row ? (
          <>
            <DialogHeader>
              <DialogTitle>{agencyName(row.agency, t)}</DialogTitle>
              <DialogDescription>
                {t("admin.groupRequests.dialog.agencyDescription")}
              </DialogDescription>
            </DialogHeader>
            <AdminDetailGrid>
              <AdminDetailItem
                label={t("admin.users.fields.fullName")}
                value={row.agency?.full_name || "-"}
              />
              <AdminDetailItem
                label={t("admin.users.fields.companyName")}
                value={row.agency?.company_name || row.agency?.legal_company_name || "-"}
              />
              <AdminDetailItem
                label={t("admin.users.fields.email")}
                value={contactEmail(row.agency)}
              />
              <AdminDetailItem
                label={t("admin.users.table.phone")}
                value={row.agency?.phone_number || row.agency?.phone || "-"}
              />
              <AdminDetailItem label={t("common.country")} value={row.agency?.country || "-"} />
              <AdminDetailItem
                label={t("admin.users.table.verification")}
                value={
                  <AdminStatusBadge
                    status={row.agency?.agency_verification_status || "unverified"}
                  />
                }
              />
            </AdminDetailGrid>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CategoryPreview({ row }: { row: AdminRfq }) {
  const { t } = useTranslation();
  const categories = row.hotel_categories_v2?.length
    ? row.hotel_categories_v2
    : [ANY_HOTEL_CATEGORY];
  return (
    <div className="flex flex-wrap gap-1">
      {categories.slice(0, 2).map((category) => (
        <Badge key={category} variant="secondary">
          {categoryLabel(category, t)}
        </Badge>
      ))}
      {categories.length > 2 ? <Badge variant="secondary">+{categories.length - 2}</Badge> : null}
    </div>
  );
}

function matchesStatus(row: AdminRfq, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "expired") return isExpired(row);
  if (filter === "pending")
    return row.status === "draft" || row.status === "quoting" || row.status === "under_review";
  if (filter === "closed") return row.status === "closed" || row.status === "awarded";
  return row.status === filter;
}

function isExpired(row: Rfq) {
  if (!row.deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(row.deadline);
  deadline.setHours(0, 0, 0, 0);
  return deadline < today && !["closed", "cancelled", "awarded"].includes(row.status);
}

function agencyName(profile: Profile | undefined, t: TFunction) {
  return (
    profile?.legal_company_name ||
    profile?.trade_name ||
    profile?.company_name ||
    profile?.org_name ||
    profile?.full_name ||
    t("admin.groupRequests.fallbacks.unknownAgency")
  );
}

function contactEmail(profile?: Profile) {
  return profile?.contact_email || profile?.contact_person_email || profile?.billing_email || "-";
}

function categoryLabel(value: string, t: TFunction) {
  if (value === ANY_HOTEL_CATEGORY) return t("rfq.categories.any");
  const key = HOTEL_CATEGORY_TRANSLATION_KEYS[value as HotelCategory];
  return key ? t(key) : value;
}

function mealPlanLabel(value: string | null, t: TFunction) {
  if (!value) return t("rfq.mealPlans.room_only");
  const mealKey = `rfq.mealPlans.${value}`;
  const boardKey = `rfq.boards.${value}`;
  const translatedMeal = t(mealKey);
  if (translatedMeal !== mealKey) return translatedMeal;
  const translatedBoard = t(boardKey);
  return translatedBoard !== boardKey ? translatedBoard : value;
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}
