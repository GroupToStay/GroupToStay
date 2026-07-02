import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Calendar, Eye, FileText, Hotel, Loader2, MapPin, Search, ShieldAlert, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/group-requests")({
  head: () => ({ meta: [{ title: "Group Requests - Admin" }] }),
  component: Page,
});

type Rfq = Database["public"]["Tables"]["rfqs"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Quote = Pick<Database["public"]["Tables"]["quotes"]["Row"], "id" | "rfq_id" | "hotel_id" | "status" | "total_price" | "currency" | "created_at" | "updated_at">;
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
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "guests", label: "Guests" },
  { value: "destination", label: "Destination" },
];

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-success/15 text-success",
  quoting: "bg-info/15 text-info",
  under_review: "bg-warning/15 text-warning",
  awarded: "bg-gold/20 text-gold-foreground border border-gold/30",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-error/15 text-error",
  expired: "bg-error/15 text-error",
};

function Page() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);

  const { data: rows = [], isLoading, error } = useQuery({
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
          ? supabase.from("quotes").select("id,rfq_id,hotel_id,status,total_price,currency,created_at,updated_at").in("rfq_id", rfqIds)
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

      const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));

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
      const { error } = await supabase.from("rfqs").update({ status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request updated");
      qc.invalidateQueries({ queryKey: ["admin-rfq-management"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Request update failed"),
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
    onError: (err: any) => toast.error(err?.message ?? "Request delete failed"),
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
        ].join(" ").toLowerCase().includes(text);
      })
      .sort((a, b) => {
        if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sort === "guests") return b.guests_count - a.guests_count;
        if (sort === "destination") return `${a.destination_country} ${a.destination_city}`.localeCompare(`${b.destination_country} ${b.destination_city}`);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [query, rows, sort, statusFilter]);

  const counts = useMemo(() => {
    return statusFilters.reduce<Record<StatusFilter, number>>((acc, item) => {
      acc[item.value] = item.value === "all" ? rows.length : rows.filter((row) => matchesStatus(row, item.value)).length;
      return acc;
    }, {} as Record<StatusFilter, number>);
  }, [rows]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <FileText className="h-7 w-7" /> RFQ Management
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">All group accommodation requests created by agencies.</p>
      </header>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder="Search by request ID, agency, destination or city"
              />
            </div>
            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatusFilter(item.value)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  statusFilter === item.value ? "border-gold bg-gold/10 text-foreground" : "border-input text-muted-foreground"
                }`}
              >
                {item.label} ({counts[item.value] ?? 0})
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading RFQs...</CardContent></Card>
      ) : error ? (
        <Card><CardContent className="p-6 text-sm text-error">Could not load RFQ management data.</CardContent></Card>
      ) : filteredRows.length === 0 ? (
        <EmptyState icon={FileText} title="No Requests Available" description="No group accommodation requests match this filter." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Request Title</TableHead>
                  <TableHead>Agency Name</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Rooms</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quotations</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const expired = isExpired(row);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{shortId(row.id)}</TableCell>
                      <TableCell className="min-w-[180px] font-medium">{row.title}</TableCell>
                      <TableCell className="min-w-[160px]">{agencyName(row.agency)}</TableCell>
                      <TableCell className="min-w-[150px]">
                        <div className="flex items-center gap-1 text-sm"><MapPin className="h-3.5 w-3.5" /> {row.destination_country}</div>
                        <div className="text-xs text-muted-foreground">{row.destination_city}</div>
                      </TableCell>
                      <TableCell>{formatDate(row.check_in)}</TableCell>
                      <TableCell>{formatDate(row.check_out)}</TableCell>
                      <TableCell>{row.guests_count}</TableCell>
                      <TableCell>{row.rooms_needed}</TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex flex-wrap gap-1">
                          {(row.hotel_categories_v2?.length ? row.hotel_categories_v2 : ["Any"]).slice(0, 3).map((category) => (
                            <Badge key={category} variant="secondary">{category}</Badge>
                          ))}
                          {(row.hotel_categories_v2?.length ?? 0) > 3 ? <Badge variant="secondary">+{(row.hotel_categories_v2?.length ?? 0) - 3}</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={expired ? "expired" : row.status} /></TableCell>
                      <TableCell>{row.quotationCount}</TableCell>
                      <TableCell>{formatDate(row.created_at)}</TableCell>
                      <TableCell>{formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setDialog({ type: "request", row })}><Eye className="h-4 w-4" /> View</Button>
                          <Button size="sm" variant="outline" onClick={() => setDialog({ type: "quotes", row })}><Hotel className="h-4 w-4" /> Quotes</Button>
                          <Button size="sm" variant="outline" onClick={() => setDialog({ type: "agency", row })}><Users className="h-4 w-4" /> Agency</Button>
                          <Button size="sm" variant="outline" disabled={row.status === "closed"} onClick={() => updateStatus.mutate({ id: row.id, status: "closed" })}>Close</Button>
                          <Button size="sm" variant="outline" disabled={row.status === "cancelled"} onClick={() => updateStatus.mutate({ id: row.id, status: "cancelled" })}>
                            <ShieldAlert className="h-4 w-4" /> Suspend
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (window.confirm("Delete this request permanently?")) deleteRequest.mutate(row.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <RfqDialog dialog={dialog} onOpenChange={(open) => !open && setDialog(null)} />
    </section>
  );
}

function RfqDialog({ dialog, onOpenChange }: { dialog: DialogState; onOpenChange: (open: boolean) => void }) {
  const row = dialog?.row;
  return (
    <Dialog open={!!dialog} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {dialog?.type === "request" && row ? (
          <>
            <DialogHeader>
              <DialogTitle>{row.title}</DialogTitle>
              <DialogDescription>Request ID: {row.id}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <Detail label="Agency" value={agencyName(row.agency)} />
              <Detail label="Destination" value={`${row.destination_country}, ${row.destination_city}`} />
              <Detail label="Check-in" value={formatDate(row.check_in)} />
              <Detail label="Check-out" value={formatDate(row.check_out)} />
              <Detail label="Guests" value={String(row.guests_count)} />
              <Detail label="Rooms" value={String(row.rooms_needed)} />
              <Detail label="Accommodation Type" value={row.accommodation_type || "Any"} />
              <Detail label="Meal Plan" value={row.meal_plan_code || row.board_type} />
              <Detail label="Status" value={row.status.replace("_", " ")} />
              <Detail label="Quotations" value={String(row.quotationCount)} />
              <Detail label="Creation Date" value={formatDate(row.created_at)} />
              <Detail label="Last Update" value={formatDate(row.updated_at)} />
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Categories</div>
                <div className="mt-1 flex flex-wrap gap-1">{(row.hotel_categories_v2?.length ? row.hotel_categories_v2 : ["Any"]).map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Requirements</div>
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-border p-3">{row.requirements || row.additional_requirements || row.special_requirements || "No requirements provided."}</p>
              </div>
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
              <EmptyState icon={Hotel} title="No Quotations" description="No hotel has submitted a quotation for this request yet." />
            ) : (
              <div className="space-y-2">
                {row.quotations.map((quote) => (
                  <div key={quote.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">Quote {shortId(quote.id)}</div>
                      <Badge className={statusColor[quote.status] ?? "bg-muted text-muted-foreground"}>{quote.status}</Badge>
                    </div>
                    <div className="mt-2 text-muted-foreground">
                      {quote.currency} {Number(quote.total_price).toLocaleString()} - submitted {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
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
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <Detail label="Full Name" value={row.agency?.full_name || "-"} />
              <Detail label="Company Name" value={row.agency?.company_name || row.agency?.legal_company_name || "-"} />
              <Detail label="Email" value={contactEmail(row.agency)} />
              <Detail label="Phone" value={row.agency?.phone_number || row.agency?.phone || "-"} />
              <Detail label="Country" value={row.agency?.country || "-"} />
              <Detail label="Verification Status" value={row.agency?.agency_verification_status || "Not available"} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function matchesStatus(row: AdminRfq, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "expired") return isExpired(row);
  if (filter === "pending") return row.status === "draft" || row.status === "quoting" || row.status === "under_review";
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
  return profile?.legal_company_name || profile?.trade_name || profile?.company_name || profile?.org_name || profile?.full_name || "Unknown agency";
}

function contactEmail(profile?: Profile) {
  return profile?.contact_email || profile?.contact_person_email || profile?.billing_email || "-";
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const dateOnly = value.includes("T") ? value.slice(0, 10) : value;
  const [year, month, day] = dateOnly.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge className={statusColor[status] ?? "bg-muted text-muted-foreground"}>{status.replace("_", " ")}</Badge>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-foreground break-words">{value}</div>
    </div>
  );
}
