"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Building2, CheckCircle2, Eye, Loader2, RotateCcw, Search, XCircle } from "lucide-react";
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
} from "@/components/admin/management-ui";
import { formatAdminDate, getPageSlice } from "@/components/admin/management-utils";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";
import i18n from "@/lib/i18n";
import { requireAdminPermission } from "@/lib/admin-authorization";

export const Route = createFileRoute("/_authenticated/admin/hotel-companies")({
  beforeLoad: () => requireAdminPermission("manage_hotels"),
  head: () => ({ meta: [{ title: i18n.t("admin.hotelCompanies.metaTitle") }] }),
  component: Page,
});

type CompanyStatus = "pending" | "approved" | "rejected";
type CompanyRow = Database["public"]["Tables"]["profiles"]["Row"];
type PmsRow = Pick<CompanyRow, "pms_enabled" | "pms_provider">;

const PMS_PROVIDERS = [
  "MyCloud PMS",
  "Oracle Opera PMS",
  "Cloudbeds",
  "Mews",
  "eZee Absolute",
  "Hotelogix",
  "Protel",
  "Other",
] as const;
const PMS_NO_PROVIDER = "No PMS";
const PMS_NOT_SPECIFIED = "Not specified";
const PMS_OTHER = "Other";

const statusOptionKeys: { value: CompanyStatus; labelKey: string }[] = [
  { value: "pending", labelKey: "status.pending_review" },
  { value: "approved", labelKey: "status.approved" },
  { value: "rejected", labelKey: "status.rejected" },
];

export function Page() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [status, setStatus] = useState<CompanyStatus>("pending");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CompanyRow | null>(null);
  const [notes, setNotes] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-companies", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, company_name, vat_number, cr_number, contact_email, phone, country, hotel_approval_status, approval_notes, created_at, pms_enabled, pms_provider, pms_provider_other, api_available, technical_contact_name, technical_contact_email, technical_contact_phone",
        )
        .eq("hotel_approval_status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CompanyRow[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      id,
      decision,
      notes,
    }: {
      id: string;
      decision: CompanyStatus;
      notes: string;
    }) => {
      const { error } = await supabase.rpc("admin_decide_approval", {
        _source_type: "hotel_verification",
        _source_id: id,
        _decision:
          decision === "approved"
            ? "approve"
            : decision === "rejected"
              ? "reject"
              : "request_changes",
        _comment:
          notes || (decision === "pending" ? t("admin.hotelCompanies.audit.reopened") : undefined),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.common.decisionSaved"));
      setSelected(null);
      setNotes("");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    },
    onError: (e: unknown) => toast.error(errorMessage(e, t("admin.common.decisionFailed"))),
  });

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row: CompanyRow) =>
      [row.company_name, row.full_name, row.contact_email, row.phone, row.country, row.pms_provider]
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [query, rows]);

  useEffect(() => {
    setPage(1);
  }, [query, status, pageSize]);

  const pageRows = getPageSlice(filteredRows, page, pageSize);

  function openDetails(row: CompanyRow) {
    setSelected(row);
    setNotes(row.approval_notes ?? "");
  }

  function makeDecision(row: CompanyRow, decision: CompanyStatus, noteValue = notes) {
    decide.mutate({ id: row.id, decision, notes: noteValue });
  }

  return (
    <AdminManagementPage
      title={t("admin.hotelCompanies.title")}
      description={t("admin.hotelCompanies.description")}
      icon={Building2}
    >
      <PmsStatistics />

      <AdminToolbar>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder={t("admin.hotelCompanies.searchPlaceholder")}
          />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as CompanyStatus)}>
          <SelectTrigger className="w-full lg:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptionKeys.map((option) => (
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
            setStatus("pending");
          }}
        >
          {t("admin.common.resetFilters")}
        </Button>
      </AdminToolbar>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("admin.hotelCompanies.loading")}
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("admin.hotelCompanies.empty.title")}
          description={t("admin.hotelCompanies.empty.description")}
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
                  <TableHead>{t("admin.hotelCompanies.table.company")}</TableHead>
                  <TableHead>{t("admin.hotelCompanies.table.contact")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("common.country")}</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    {t("admin.hotelCompanies.table.pms")}
                  </TableHead>
                  <TableHead>{t("admin.hotelCompanies.table.status")}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("admin.hotelCompanies.table.created")}
                  </TableHead>
                  <TableHead className="w-12 text-right">
                    {t("admin.hotelCompanies.table.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row: CompanyRow) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => openDetails(row)}
                  >
                    <TableCell className="min-w-[220px]">
                      <div className="font-medium text-foreground">{row.company_name || "-"}</div>
                      <div className="text-xs text-muted-foreground">{row.full_name || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <div>{row.contact_email || "-"}</div>
                      <div className="text-xs text-muted-foreground">{row.phone || "-"}</div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{row.country || "-"}</TableCell>
                    <TableCell className="hidden xl:table-cell">{pmsLabel(row, t)}</TableCell>
                    <TableCell>
                      <AdminStatusBadge status={row.hotel_approval_status} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {formatAdminDate(row.created_at)}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end">
                        <CompanyActions
                          row={row}
                          onView={() => openDetails(row)}
                          onApprove={() => makeDecision(row, "approved", row.approval_notes ?? "")}
                          onReject={() => makeDecision(row, "rejected", row.approval_notes ?? "")}
                          onReconsider={() =>
                            makeDecision(row, "pending", row.approval_notes ?? "")
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y divide-border md:hidden">
            {pageRows.map((row: CompanyRow) => (
              <div key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => openDetails(row)}
                  >
                    <div className="font-medium">{row.company_name || "-"}</div>
                    <div className="text-xs text-muted-foreground">{row.contact_email || "-"}</div>
                  </button>
                  <CompanyActions
                    row={row}
                    onView={() => openDetails(row)}
                    onApprove={() => makeDecision(row, "approved", row.approval_notes ?? "")}
                    onReject={() => makeDecision(row, "rejected", row.approval_notes ?? "")}
                    onReconsider={() => makeDecision(row, "pending", row.approval_notes ?? "")}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminStatusBadge status={row.hotel_approval_status} />
                  <span className="text-xs text-muted-foreground">{row.country || "-"}</span>
                </div>
              </div>
            ))}
          </div>
        </AdminTableCard>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {selected.company_name || t("admin.hotelCompanies.fallbacks.hotelCompany")}
                  <AdminStatusBadge status={selected.hotel_approval_status} />
                </DialogTitle>
              </DialogHeader>

              <AdminDetailGrid>
                <AdminDetailItem
                  label={t("admin.hotelCompanies.details.companyName")}
                  value={selected.company_name}
                />
                <AdminDetailItem
                  label={t("admin.hotelCompanies.details.contactName")}
                  value={selected.full_name}
                />
                <AdminDetailItem
                  label={t("admin.users.fields.email")}
                  value={selected.contact_email}
                />
                <AdminDetailItem label={t("admin.users.table.phone")} value={selected.phone} />
                <AdminDetailItem label={t("common.country")} value={selected.country} />
                <AdminDetailItem
                  label={t("admin.hotelCompanies.details.vatNumber")}
                  value={selected.vat_number}
                />
                <AdminDetailItem
                  label={t("admin.hotelCompanies.details.crNumber")}
                  value={selected.cr_number}
                />
                <AdminDetailItem
                  label={t("admin.hotelCompanies.table.pms")}
                  value={pmsLabel(selected, t)}
                />
                <AdminDetailItem
                  label={t("admin.hotelCompanies.details.apiAvailable")}
                  value={selected.api_available || "-"}
                />
                <AdminDetailItem
                  label={t("admin.hotelCompanies.details.technicalContact")}
                  value={selected.technical_contact_name || "-"}
                />
                <AdminDetailItem
                  label={t("admin.hotelCompanies.details.technicalEmail")}
                  value={selected.technical_contact_email || "-"}
                />
                <AdminDetailItem
                  label={t("admin.hotelCompanies.details.technicalPhone")}
                  value={selected.technical_contact_phone || "-"}
                />
              </AdminDetailGrid>

              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("admin.hotelCompanies.details.approvalNotes")}
                </label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={500}
                  placeholder={t("admin.hotelCompanies.details.approvalNotesPlaceholder")}
                />
              </div>

              <DialogFooter className="flex-wrap gap-2">
                {selected.hotel_approval_status === "approved" ? (
                  <AdminStatusBadge status="locked" />
                ) : selected.hotel_approval_status === "rejected" ? (
                  <Button variant="outline" onClick={() => makeDecision(selected, "pending")}>
                    <RotateCcw className="h-4 w-4" /> {t("admin.common.actions.reconsider")}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => makeDecision(selected, "rejected")}
                    >
                      <XCircle className="h-4 w-4" /> {t("admin.common.actions.reject")}
                    </Button>
                    <Button variant="gold" onClick={() => makeDecision(selected, "approved")}>
                      <CheckCircle2 className="h-4 w-4" /> {t("admin.common.actions.approve")}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminManagementPage>
  );
}

function PmsStatistics() {
  const { t } = useTranslation();
  const { data: counts = {}, isLoading } = useQuery({
    queryKey: ["admin-pms-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("pms_enabled, pms_provider")
        .eq("hotel_approval_status", "approved");
      if (error) throw error;
      const c: Record<string, number> = { [PMS_NO_PROVIDER]: 0, [PMS_NOT_SPECIFIED]: 0 };
      PMS_PROVIDERS.forEach((provider) => {
        c[provider] = 0;
      });
      ((data ?? []) as PmsRow[]).forEach((row) => {
        if (row.pms_enabled === false) c[PMS_NO_PROVIDER]++;
        else if (row.pms_enabled === true) {
          const provider =
            row.pms_provider &&
            PMS_PROVIDERS.includes(row.pms_provider as (typeof PMS_PROVIDERS)[number])
              ? row.pms_provider
              : row.pms_provider
                ? PMS_OTHER
                : PMS_NOT_SPECIFIED;
          c[provider] = (c[provider] ?? 0) + 1;
        } else c[PMS_NOT_SPECIFIED]++;
      });
      return c;
    },
  });

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-primary">
              {t("admin.hotelCompanies.pms.title")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("admin.hotelCompanies.pms.description")}
            </p>
          </div>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(counts).map(([label, count]) => (
            <div key={label} className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="truncate text-xs text-muted-foreground">
                {pmsProviderLabel(label, t)}
              </div>
              <div className="font-display text-2xl text-primary">{count as number}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CompanyActions({
  row,
  onView,
  onApprove,
  onReject,
  onReconsider,
}: {
  row: CompanyRow;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReconsider: () => void;
}) {
  const { t } = useTranslation();
  const approved = row.hotel_approval_status === "approved";
  const rejected = row.hotel_approval_status === "rejected";
  return (
    <AdminActionMenu
      items={[
        { label: t("admin.common.actions.viewDetails"), icon: Eye, onSelect: onView },
        rejected
          ? {
              label: t("admin.common.actions.reconsider"),
              icon: RotateCcw,
              onSelect: onReconsider,
              separatorBefore: true,
            }
          : {
              label: t("admin.common.actions.approve"),
              icon: CheckCircle2,
              onSelect: onApprove,
              disabled: approved,
              separatorBefore: true,
            },
        {
          label: t("admin.common.actions.reject"),
          icon: XCircle,
          onSelect: onReject,
          disabled: approved || rejected,
          destructive: true,
        },
      ]}
    />
  );
}

function pmsLabel(row: CompanyRow, t: (key: string, options?: Record<string, string>) => string) {
  if (row.pms_enabled === false) return t("admin.hotelCompanies.pms.noPms");
  if (row.pms_enabled === true)
    return row.pms_provider === PMS_OTHER && row.pms_provider_other
      ? t("admin.hotelCompanies.pms.otherWithName", { name: row.pms_provider_other })
      : pmsProviderLabel(row.pms_provider || PMS_NOT_SPECIFIED, t);
  return t("admin.hotelCompanies.pms.notSpecified");
}

function pmsProviderLabel(
  value: string,
  t: (key: string, options?: Record<string, string>) => string,
) {
  const key = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return t(`admin.hotelCompanies.pms.providers.${key}`, { defaultValue: value });
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}
