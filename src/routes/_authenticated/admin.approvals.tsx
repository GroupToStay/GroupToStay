"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  Loader2,
  MessageSquareMore,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
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
import { formatAdminDate, getPageSlice } from "@/components/admin/management-utils";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { requireAdminPermission } from "@/lib/admin-authorization";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  beforeLoad: () => requireAdminPermission("manage_approvals"),
  head: () => ({ meta: [{ title: i18n.t("admin.approvals.metaTitle") }] }),
  component: ApprovalCenter,
});

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Hotel = Database["public"]["Tables"]["hotels"]["Row"];
type Subscription = Database["public"]["Tables"]["subscription_interest"]["Row"];
type AuditLog = Database["public"]["Tables"]["admin_audit_logs"]["Row"];
type AgencyEvent = Database["public"]["Tables"]["agency_verification_events"]["Row"];
type ApprovalSource =
  | "agency_verification"
  | "hotel_verification"
  | "hotel_listing"
  | "subscription_request";
type ApprovalDecision = "approve" | "reject" | "request_changes";
type ApprovalSection =
  | "all"
  | "agency"
  | "hotel"
  | "subscriptions"
  | "documents"
  | "profiles"
  | "pending"
  | "manual";
type ApprovalPriority = "normal" | "medium" | "high";

type ApprovalItem = {
  id: string;
  source: ApprovalSource;
  title: string;
  submittedBy: string;
  submittedAt: string;
  status: string;
  priority: ApprovalPriority;
  notes: string | null;
  hasDocuments: boolean;
  details: Record<string, string | null | undefined>;
};

const sectionKeys: { value: ApprovalSection; labelKey: string }[] = [
  { value: "all", labelKey: "admin.approvals.sections.all" },
  { value: "agency", labelKey: "admin.approvals.sections.agencies" },
  { value: "hotel", labelKey: "admin.approvals.sections.hotels" },
  { value: "subscriptions", labelKey: "admin.approvals.sections.subscriptions" },
  { value: "documents", labelKey: "admin.approvals.sections.documents" },
  { value: "profiles", labelKey: "admin.approvals.sections.profiles" },
  { value: "pending", labelKey: "admin.approvals.sections.pending" },
  { value: "manual", labelKey: "admin.approvals.sections.manual" },
];

export function ApprovalCenter() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<ApprovalSection>("pending");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [decision, setDecision] = useState<ApprovalDecision | null>(null);
  const [comment, setComment] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-approval-center"],
    queryFn: loadApprovalItems,
  });

  const decide = useMutation({
    mutationFn: async ({
      item,
      nextDecision,
      note,
    }: {
      item: ApprovalItem;
      nextDecision: ApprovalDecision;
      note: string;
    }) => {
      const { error: decisionError } = await supabase.rpc("admin_decide_approval", {
        _source_type: item.source,
        _source_id: item.id,
        _decision: nextDecision,
        _comment: note || undefined,
      });
      if (decisionError) throw decisionError;
    },
    onSuccess: () => {
      toast.success(t("admin.approvals.toasts.decisionSaved"));
      setDecision(null);
      setSelected(null);
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["admin-approval-center"] });
      queryClient.invalidateQueries({ queryKey: ["admin-home-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-approval-history"] });
    },
    onError: (mutationError: unknown) =>
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : t("admin.approvals.errors.decisionFailed"),
      ),
  });

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchesSection(item, section)) return false;
      if (!search) return true;
      return [
        item.title,
        item.submittedBy,
        item.status,
        item.source,
        ...Object.values(item.details),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [items, query, section]);

  useEffect(() => setPage(1), [pageSize, query, section]);

  const metrics: AdminMetric[] = [
    {
      label: t("admin.approvals.metrics.pending"),
      value: items.filter(isPending).length,
      icon: Clock3,
      tone: "warning",
    },
    {
      label: t("admin.approvals.metrics.agencies"),
      value: items.filter((item) => item.source === "agency_verification" && isPending(item))
        .length,
      icon: BadgeCheck,
      tone: "info",
    },
    {
      label: t("admin.approvals.metrics.hotels"),
      value: items.filter(
        (item) =>
          (item.source === "hotel_verification" || item.source === "hotel_listing") &&
          isPending(item),
      ).length,
      icon: Building2,
      tone: "gold",
    },
    {
      label: t("admin.approvals.metrics.priority"),
      value: items.filter((item) => item.priority === "high" && isPending(item)).length,
      icon: ShieldCheck,
      tone: "error",
    },
  ];

  const pageItems = getPageSlice(filtered, page, pageSize);

  function beginDecision(item: ApprovalItem, nextDecision: ApprovalDecision) {
    setSelected(item);
    setDecision(nextDecision);
    setComment("");
  }

  function submitDecision() {
    if (!selected || !decision) return;
    if (decision !== "approve" && !comment.trim()) {
      toast.error(t("admin.approvals.errors.commentRequired"));
      return;
    }
    decide.mutate({ item: selected, nextDecision: decision, note: comment.trim() });
  }

  return (
    <AdminManagementPage
      title={t("admin.approvals.title")}
      description={t("admin.approvals.description")}
      icon={FileCheck2}
      metrics={metrics}
    >
      <AdminToolbar>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("admin.approvals.searchPlaceholder")}
            className="pl-9 rtl:pl-3 rtl:pr-9"
          />
        </div>
        <Select value={section} onValueChange={(value) => setSection(value as ApprovalSection)}>
          <SelectTrigger className="w-full lg:w-64" aria-label={t("admin.approvals.sectionLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sectionKeys.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {t(item.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </AdminToolbar>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("admin.approvals.loading")}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-error">
            {t("admin.approvals.errors.loadFailed")}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title={t("admin.approvals.empty.title")}
          description={t("admin.approvals.empty.description")}
        />
      ) : (
        <AdminTableCard
          footer={
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>{t("admin.approvals.table.item")}</TableHead>
                  <TableHead>{t("admin.approvals.table.type")}</TableHead>
                  <TableHead>{t("admin.approvals.table.status")}</TableHead>
                  <TableHead>{t("admin.approvals.table.priority")}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("admin.approvals.table.submitted")}
                  </TableHead>
                  <TableHead className="w-12 text-right">
                    {t("admin.approvals.table.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((item) => (
                  <TableRow
                    key={`${item.source}-${item.id}`}
                    className="cursor-pointer"
                    onClick={() => setSelected(item)}
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.submittedBy}</div>
                    </TableCell>
                    <TableCell>{t(`admin.approvals.sources.${item.source}`)}</TableCell>
                    <TableCell>
                      <AdminStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge status={item.priority} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {formatAdminDate(item.submittedAt)}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end">
                        <ApprovalActions
                          item={item}
                          onView={() => setSelected(item)}
                          onApprove={() => beginDecision(item, "approve")}
                          onReject={() => beginDecision(item, "reject")}
                          onRequestChanges={() => beginDecision(item, "request_changes")}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y divide-border md:hidden">
            {pageItems.map((item) => (
              <div key={`${item.source}-${item.id}`} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 text-left rtl:text-right"
                    onClick={() => setSelected(item)}
                  >
                    <span className="block truncate font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.submittedBy}
                    </span>
                  </button>
                  <ApprovalActions
                    item={item}
                    onView={() => setSelected(item)}
                    onApprove={() => beginDecision(item, "approve")}
                    onReject={() => beginDecision(item, "reject")}
                    onRequestChanges={() => beginDecision(item, "request_changes")}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminStatusBadge status={item.status} />
                  <AdminStatusBadge status={item.priority} />
                </div>
              </div>
            ))}
          </div>
        </AdminTableCard>
      )}

      <ApprovalDetails
        item={decision ? null : selected}
        onClose={() => setSelected(null)}
        onDecision={beginDecision}
      />

      <Dialog
        open={!!decision && !!selected}
        onOpenChange={(open) => {
          if (!open) {
            setDecision(null);
            setComment("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision ? t(`admin.approvals.decisions.${decision}`) : ""}</DialogTitle>
            <DialogDescription>{selected?.title}</DialogDescription>
          </DialogHeader>
          {decision !== "approve" ? (
            <label className="space-y-2 text-sm">
              <span className="font-medium">{t("admin.approvals.commentLabel")}</span>
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={t("admin.approvals.commentPlaceholder")}
                rows={5}
              />
            </label>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant={decision === "reject" ? "destructive" : "gold"}
              disabled={decide.isPending}
              onClick={submitDecision}
            >
              {decide.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminManagementPage>
  );
}

function ApprovalActions({
  item,
  onView,
  onApprove,
  onReject,
  onRequestChanges,
}: {
  item: ApprovalItem;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
}) {
  const { t } = useTranslation();
  const complete = !isPending(item);
  return (
    <AdminActionMenu
      items={[
        { label: t("admin.common.actions.viewDetails"), icon: Eye, onSelect: onView },
        {
          label: t("admin.common.actions.approve"),
          icon: CheckCircle2,
          onSelect: onApprove,
          disabled: complete,
          separatorBefore: true,
        },
        {
          label: t("admin.common.actions.reject"),
          icon: XCircle,
          onSelect: onReject,
          disabled: complete,
          destructive: true,
        },
        {
          label: t("admin.common.actions.requestMoreInfo"),
          icon: MessageSquareMore,
          onSelect: onRequestChanges,
          disabled: complete,
        },
      ]}
    />
  );
}

function ApprovalDetails({
  item,
  onClose,
  onDecision,
}: {
  item: ApprovalItem | null;
  onClose: () => void;
  onDecision: (item: ApprovalItem, decision: ApprovalDecision) => void;
}) {
  const { t } = useTranslation();
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["admin-approval-history", item?.source, item?.id],
    enabled: !!item,
    queryFn: async () => {
      const { data: audit, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .eq("entity_type", item!.source)
        .eq("entity_id", item!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      let agencyEvents: AgencyEvent[] = [];
      if (item!.source === "agency_verification") {
        const result = await supabase
          .from("agency_verification_events")
          .select("*")
          .eq("agency_id", item!.id)
          .order("created_at", { ascending: false });
        if (result.error) throw result.error;
        agencyEvents = result.data ?? [];
      }

      return [
        ...((audit ?? []) as AuditLog[]).map((entry) => ({
          id: entry.id,
          action: entry.action,
          comment: entry.comment,
          createdAt: entry.created_at,
        })),
        ...agencyEvents.map((entry) => ({
          id: entry.id,
          action: entry.event_type,
          comment: entry.notes,
          createdAt: entry.created_at,
        })),
      ].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
    },
  });

  async function openDocument(path: string) {
    const { data, error } = await supabase.storage
      .from("agency-documents")
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error(t("admin.approvals.errors.documentFailed"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {item ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {item.title}
                <AdminStatusBadge status={item.status} />
              </DialogTitle>
              <DialogDescription>{t(`admin.approvals.sources.${item.source}`)}</DialogDescription>
            </DialogHeader>

            <AdminDetailGrid>
              <AdminDetailItem
                label={t("admin.approvals.table.submittedBy")}
                value={item.submittedBy}
              />
              <AdminDetailItem
                label={t("admin.approvals.table.submitted")}
                value={formatAdminDate(item.submittedAt)}
              />
              <AdminDetailItem
                label={t("admin.approvals.table.priority")}
                value={<AdminStatusBadge status={item.priority} />}
              />
              <AdminDetailItem
                label={t("admin.approvals.details.notes")}
                value={item.notes || "-"}
              />
              {Object.entries(item.details).map(([key, value]) => (
                <AdminDetailItem
                  key={key}
                  label={t(`admin.approvals.details.${key}`, { defaultValue: key })}
                  value={value || "-"}
                />
              ))}
            </AdminDetailGrid>

            {item.source === "agency_verification" && item.hasDocuments ? (
              <div className="flex flex-wrap gap-2">
                {item.details.crDocument ? (
                  <Button variant="outline" onClick={() => openDocument(item.details.crDocument!)}>
                    <FileText className="h-4 w-4" />
                    {t("admin.approvals.details.openCommercialRegistration")}
                  </Button>
                ) : null}
                {item.details.tourismDocument ? (
                  <Button
                    variant="outline"
                    onClick={() => openDocument(item.details.tourismDocument!)}
                  >
                    <FileText className="h-4 w-4" />
                    {t("admin.approvals.details.openTourismLicense")}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("admin.approvals.history.title")}</h3>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : history.length ? (
                <ol className="space-y-2">
                  {history.map((entry) => (
                    <li key={entry.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">
                          {t(`admin.approvals.history.events.${entry.action}`, {
                            defaultValue: entry.action.replaceAll("_", " "),
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatAdminDate(entry.createdAt)}
                        </span>
                      </div>
                      {entry.comment ? (
                        <p className="mt-1 text-muted-foreground">{entry.comment}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("admin.approvals.history.empty")}
                </p>
              )}
            </section>

            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={onClose}>
                {t("common.close")}
              </Button>
              {isPending(item) ? (
                <>
                  <Button variant="outline" onClick={() => onDecision(item, "request_changes")}>
                    <MessageSquareMore className="h-4 w-4" />
                    {t("admin.common.actions.requestMoreInfo")}
                  </Button>
                  <Button variant="destructive" onClick={() => onDecision(item, "reject")}>
                    <XCircle className="h-4 w-4" />
                    {t("admin.common.actions.reject")}
                  </Button>
                  <Button variant="gold" onClick={() => onDecision(item, "approve")}>
                    <CheckCircle2 className="h-4 w-4" />
                    {t("admin.common.actions.approve")}
                  </Button>
                </>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

async function loadApprovalItems(): Promise<ApprovalItem[]> {
  const [profilesResult, hotelsResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .or("agency_verification_status.not.is.null,hotel_approval_status.not.is.null")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase.from("hotels").select("*").order("created_at", { ascending: false }).limit(250),
    supabase
      .from("subscription_interest")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(250),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (hotelsResult.error) throw hotelsResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  const items: ApprovalItem[] = [];
  ((profilesResult.data ?? []) as Profile[]).forEach((profile) => {
    if (profile.agency_verification_status) items.push(agencyItem(profile));
    if (profile.hotel_approval_status) items.push(hotelProfileItem(profile));
  });
  ((hotelsResult.data ?? []) as Hotel[]).forEach((hotel) => items.push(hotelListingItem(hotel)));
  ((subscriptionsResult.data ?? []) as Subscription[]).forEach((subscription) =>
    items.push(subscriptionItem(subscription)),
  );

  return items.sort(
    (left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime(),
  );
}

function agencyItem(profile: Profile): ApprovalItem {
  const submittedAt = profile.verification_submitted_at ?? profile.created_at;
  return {
    id: profile.id,
    source: "agency_verification",
    title:
      profile.legal_company_name ||
      profile.trade_name ||
      profile.company_name ||
      profile.full_name ||
      i18n.t("admin.approvals.fallbacks.agency"),
    submittedBy: profile.contact_person_name || profile.full_name || "-",
    submittedAt,
    status: profile.agency_verification_status ?? "draft",
    priority: priorityFromDate(submittedAt),
    notes: profile.verification_rejection_reason,
    hasDocuments: !!(profile.cr_document_path || profile.tourism_license_document_path),
    details: {
      country: profile.country,
      email: profile.contact_person_email || profile.contact_email,
      phone: profile.contact_person_phone || profile.phone_number || profile.phone,
      registrationNumber: profile.cr_number,
      crDocument: profile.cr_document_path,
      tourismDocument: profile.tourism_license_document_path,
    },
  };
}

function hotelProfileItem(profile: Profile): ApprovalItem {
  return {
    id: profile.id,
    source: "hotel_verification",
    title:
      profile.company_name ||
      profile.org_name ||
      profile.full_name ||
      i18n.t("admin.approvals.fallbacks.hotel"),
    submittedBy: profile.full_name || profile.contact_person_name || "-",
    submittedAt: profile.created_at,
    status: profile.hotel_approval_status ?? "pending",
    priority: priorityFromDate(profile.created_at),
    notes: profile.approval_notes,
    hasDocuments: false,
    details: {
      country: profile.country,
      email: profile.contact_email,
      phone: profile.phone_number || profile.phone,
      pmsProvider: profile.pms_provider,
    },
  };
}

function hotelListingItem(hotel: Hotel): ApprovalItem {
  return {
    id: hotel.id,
    source: "hotel_listing",
    title: hotel.name,
    submittedBy: hotel.owner_id || "-",
    submittedAt: hotel.created_at,
    status: hotel.status,
    priority: priorityFromDate(hotel.created_at),
    notes: null,
    hasDocuments: false,
    details: {
      country: hotel.country,
      city: hotel.city,
      address: hotel.address,
    },
  };
}

function subscriptionItem(subscription: Subscription): ApprovalItem {
  return {
    id: subscription.id,
    source: "subscription_request",
    title: subscription.hotel_name || subscription.full_name,
    submittedBy: subscription.full_name,
    submittedAt: subscription.created_at,
    status: subscription.approval_status,
    priority: priorityFromDate(subscription.created_at),
    notes: subscription.approval_notes,
    hasDocuments: false,
    details: {
      email: subscription.email,
      requestedPlan: subscription.requested_plan,
    },
  };
}

function priorityFromDate(value: string): ApprovalPriority {
  const age = Date.now() - new Date(value).getTime();
  if (age >= 7 * 86_400_000) return "high";
  if (age >= 3 * 86_400_000) return "medium";
  return "normal";
}

function isPending(item: ApprovalItem) {
  return ["submitted", "pending", "pending_review", "changes_requested"].includes(item.status);
}

function matchesSection(item: ApprovalItem, section: ApprovalSection) {
  if (section === "all") return true;
  if (section === "agency") return item.source === "agency_verification";
  if (section === "hotel")
    return item.source === "hotel_verification" || item.source === "hotel_listing";
  if (section === "subscriptions") return item.source === "subscription_request";
  if (section === "documents") return item.hasDocuments;
  if (section === "profiles")
    return item.source === "agency_verification" || item.source === "hotel_verification";
  if (section === "pending") return isPending(item);
  return item.source === "subscription_request";
}
