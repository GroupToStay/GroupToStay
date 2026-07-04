import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
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

export const Route = createFileRoute("/_authenticated/admin/group-requests")({
  head: () => ({ meta: [{ title: "Group Requests - Admin" }] }),
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

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "guests", label: "Guests" },
  { value: "destination", label: "Destination" },
];

function Page() {
  const qc = useQueryClient();
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
      toast.success("Request updated");
      qc.invalidateQueries({ queryKey: ["admin-rfq-management"] });
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Request update failed")),
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rfqs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request deleted");
      qc.invalidateQueries({ queryKey: ["admin-rfq-management"] });
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Request delete failed")),
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
          agencyName(row.agency),
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
          return `${a.destination_country} ${a.destination_city}`.localeCompare(
            `${b.destination_country} ${b.destination_city}`,
          );
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [query, rows, sort, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sort, pageSize]);

  const pageRows = getPageSlice(filteredRows, page, pageSize);
  const counts = useMemo(() => {
    return statusFilters.reduce<Record<StatusFilter, number>>(
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
      label: "All Requests",
      value: formatCompactNumber(rows.length),
      description: "Total RFQs",
      icon: FileText,
      tone: "info",
    },
    {
      label: "Pending",
      value: formatCompactNumber(counts.pending ?? 0),
      description: "Awaiting quotes or review",
      icon: Calendar,
      tone: "warning",
    },
    {
      label: "Open",
      value: formatCompactNumber(counts.open ?? 0),
      description: "Actively quoting",
      icon: Hotel,
      tone: "success",
    },
    {
      label: "Closed",
      value: formatCompactNumber(counts.closed ?? 0),
      description: "Completed or awarded",
      icon: RotateCcw,
      tone: "neutral",
    },
    {
      label: "Cancelled",
      value: formatCompactNumber(counts.cancelled ?? 0),
      description: "Cancelled requests",
      icon: ShieldAlert,
      tone: "error",
    },
  ];

  return (
    <AdminManagementPage
      title="Group Requests (RFQ)"
      description="Manage all accommodation requests created by agencies."
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
            placeholder="Search by ID, agency, destination or city"
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
            {statusFilters.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
          <SelectTrigger className="w-full lg:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
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
          Reset Filters
        </Button>
      </AdminToolbar>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading RFQs...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-error">
            Could not load RFQ management data.
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Requests Available"
          description="No group accommodation requests match these filters."
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
                  <TableHead>RFQ</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Guests / Rooms</TableHead>
                  <TableHead className="hidden xl:table-cell">Categories</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quotes</TableHead>
                  <TableHead className="hidden lg:table-cell">Updated</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
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
                      <div className="font-medium">{agencyName(row.agency)}</div>
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
                      <div>{row.guests_count} guests</div>
                      <div className="text-xs text-muted-foreground">{row.rooms_needed} rooms</div>
                    </TableCell>
                    <TableCell className="hidden max-w-[220px] xl:table-cell">
                      <CategoryPreview row={row} />
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge status={isExpired(row) ? "expired" : row.status} />
                    </TableCell>
                    <TableCell className="font-medium">{row.quotationCount}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}
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
                            if (window.confirm("Delete this request permanently?"))
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
                      if (window.confirm("Delete this request permanently?"))
                        deleteRequest.mutate(row.id);
                    }}
                  />
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Agency</span>
                    <span className="text-right">{agencyName(row.agency)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Destination</span>
                    <span className="text-right">
                      {row.destination_city}, {row.destination_country}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Guests / rooms</span>
                    <span>
                      {row.guests_count} / {row.rooms_needed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Status</span>
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
  return (
    <AdminActionMenu
      items={[
        { label: "View Request", icon: Eye, onSelect: onView },
        { label: "View Quotations", icon: Hotel, onSelect: onQuotes },
        { label: "View Agency", icon: Users, onSelect: onAgency },
        {
          label: "Close Request",
          icon: RotateCcw,
          onSelect: onClose,
          disabled: row.status === "closed",
        },
        {
          label: "Suspend Request",
          icon: ShieldAlert,
          onSelect: onSuspend,
          disabled: row.status === "cancelled",
        },
        {
          label: "Delete Request",
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
              <DialogDescription>Request ID: {row.id}</DialogDescription>
            </DialogHeader>
            <AdminDetailGrid>
              <AdminDetailItem label="Agency" value={agencyName(row.agency)} />
              <AdminDetailItem
                label="Destination"
                value={`${row.destination_country}, ${row.destination_city}`}
              />
              <AdminDetailItem label="Check-in" value={formatAdminDate(row.check_in)} />
              <AdminDetailItem label="Check-out" value={formatAdminDate(row.check_out)} />
              <AdminDetailItem label="Guests" value={row.guests_count} />
              <AdminDetailItem label="Rooms" value={row.rooms_needed} />
              <AdminDetailItem label="Accommodation Type" value={row.accommodation_type || "Any"} />
              <AdminDetailItem label="Meal Plan" value={row.meal_plan_code || row.board_type} />
              <AdminDetailItem label="Quotations" value={row.quotationCount} />
              <AdminDetailItem label="Created" value={formatAdminDate(row.created_at)} />
              <AdminDetailItem label="Last Update" value={formatAdminDate(row.updated_at)} />
              <AdminDetailItem label="Deadline" value={formatAdminDate(row.deadline)} />
            </AdminDetailGrid>
            <div className="rounded-md border border-border bg-surface/60 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Categories
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(row.hotel_categories_v2?.length ? row.hotel_categories_v2 : ["Any"]).map(
                  (item) => (
                    <Badge key={item} variant="secondary">
                      {item}
                    </Badge>
                  ),
                )}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface/60 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Requirements
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {row.requirements ||
                  row.additional_requirements ||
                  row.special_requirements ||
                  "No requirements provided."}
              </p>
            </div>
          </>
        ) : null}

        {dialog?.type === "quotes" && row ? (
          <>
            <DialogHeader>
              <DialogTitle>Quotations for {row.title}</DialogTitle>
              <DialogDescription>{row.quotationCount} quotations received.</DialogDescription>
            </DialogHeader>
            {row.quotations.length === 0 ? (
              <EmptyState
                icon={Hotel}
                title="No Quotations"
                description="No hotel has submitted a quotation for this request yet."
              />
            ) : (
              <div className="space-y-2">
                {row.quotations.map((quote) => (
                  <div
                    key={quote.id}
                    className="rounded-md border border-border bg-surface/60 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">Quote {shortId(quote.id)}</div>
                      <AdminStatusBadge status={quote.status} />
                    </div>
                    <div className="mt-2 text-muted-foreground">
                      {quote.currency} {Number(quote.total_price).toLocaleString()} - submitted{" "}
                      {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
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
              <DialogTitle>{agencyName(row.agency)}</DialogTitle>
              <DialogDescription>Agency profile connected to this RFQ.</DialogDescription>
            </DialogHeader>
            <AdminDetailGrid>
              <AdminDetailItem label="Full Name" value={row.agency?.full_name || "-"} />
              <AdminDetailItem
                label="Company Name"
                value={row.agency?.company_name || row.agency?.legal_company_name || "-"}
              />
              <AdminDetailItem label="Email" value={contactEmail(row.agency)} />
              <AdminDetailItem
                label="Phone"
                value={row.agency?.phone_number || row.agency?.phone || "-"}
              />
              <AdminDetailItem label="Country" value={row.agency?.country || "-"} />
              <AdminDetailItem
                label="Verification Status"
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
  const categories = row.hotel_categories_v2?.length ? row.hotel_categories_v2 : ["Any"];
  return (
    <div className="flex flex-wrap gap-1">
      {categories.slice(0, 2).map((category) => (
        <Badge key={category} variant="secondary">
          {category}
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

function agencyName(profile?: Profile) {
  return (
    profile?.legal_company_name ||
    profile?.trade_name ||
    profile?.company_name ||
    profile?.org_name ||
    profile?.full_name ||
    "Unknown agency"
  );
}

function contactEmail(profile?: Profile) {
  return profile?.contact_email || profile?.contact_person_email || profile?.billing_email || "-";
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}
