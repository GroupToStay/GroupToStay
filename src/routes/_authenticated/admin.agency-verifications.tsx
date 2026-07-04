import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  BadgeCheck,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
  XCircle,
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
} from "@/components/admin/management-ui";
import { formatAdminDate, getPageSlice } from "@/components/admin/management-utils";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/admin/agency-verifications")({
  head: () => ({ meta: [{ title: "Agency Verifications - Admin" }] }),
  component: Page,
});

type Row = Database["public"]["Tables"]["profiles"]["Row"] & { city?: string | null };
type ProfilePatch = Database["public"]["Tables"]["profiles"]["Update"];
type AgencyEvent = Database["public"]["Tables"]["agency_verification_events"]["Row"];
type Tab = "pending" | "verified" | "rejected" | "all";

const tabOptions: { value: Tab; label: string }[] = [
  { value: "pending", label: "Pending Review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All Status" },
];

function Page() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-agency-verifications", tab],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("*")
        .not("agency_verification_status", "is", null)
        .order("verification_submitted_at", { ascending: false, nullsFirst: false });
      if (tab === "pending")
        q = q.in("agency_verification_status", ["submitted", "pending_review"]);
      else if (tab === "verified") q = q.eq("agency_verification_status", "verified");
      else if (tab === "rejected") q = q.eq("agency_verification_status", "rejected");
      const { data } = await q;
      if (!data) return [];
      const ids = data.map((d) => d.id);
      if (!ids.length) return [];
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      const agencyIds = new Set(
        (roles ?? []).filter((r) => r.role === "organizer").map((r) => r.user_id),
      );
      return data.filter((d) => agencyIds.has(d.id));
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["agency-events", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("agency_verification_events")
        .select("*")
        .eq("agency_id", selected!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as AgencyEvent[];
    },
  });

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row: Row) =>
      [
        agencyName(row),
        row.country,
        row.city,
        row.agency_type,
        row.contact_person_email,
        row.contact_email,
        row.contact_person_phone,
      ]
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [query, rows]);

  useEffect(() => {
    setPage(1);
  }, [query, tab, pageSize]);

  const pageRows = getPageSlice(filteredRows, page, pageSize);

  async function getDocUrl(path?: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage.from("agency-documents").createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  }

  async function act(kind: "approve" | "reject" | "info", row = selected) {
    if (!row || !user) return;
    if ((kind === "reject" || kind === "info") && !note.trim())
      return toast.error("Please write a reason / note");
    setBusy(true);
    try {
      const status =
        kind === "approve" ? "verified" : kind === "reject" ? "rejected" : "pending_review";
      const patch: ProfilePatch = {
        agency_verification_status: status,
        verification_reviewed_at: new Date().toISOString(),
        verification_reviewed_by: user.id,
      };
      if (kind === "reject" || kind === "info") patch.verification_rejection_reason = note.trim();
      if (kind === "approve") patch.verification_rejection_reason = null;
      const { error } = await supabase.from("profiles").update(patch).eq("id", row.id);
      if (error) throw error;
      await supabase.from("agency_verification_events").insert({
        agency_id: row.id,
        event_type:
          kind === "approve" ? "approved" : kind === "reject" ? "rejected" : "info_requested",
        notes: note.trim() || null,
        actor_id: user.id,
      });
      toast.success(
        kind === "approve"
          ? "Agency verified"
          : kind === "reject"
            ? "Agency rejected"
            : "Info requested",
      );
      setSelected(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-agency-verifications"] });
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Action failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminManagementPage
      title="Agency Verifications"
      description="Review submitted agency profiles, documents and verification history."
      icon={BadgeCheck}
    >
      <AdminToolbar>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder="Search by agency, country, type, email or phone"
          />
        </div>
        <Select value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <SelectTrigger className="w-full lg:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tabOptions.map((option) => (
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
            setTab("pending");
          }}
        >
          Reset Filters
        </Button>
      </AdminToolbar>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading agencies...
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No Submissions"
          description="No agency verification submissions match these filters."
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
                  <TableHead>Agency</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="hidden lg:table-cell">Agency Type</TableHead>
                  <TableHead className="hidden xl:table-cell">Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row: Row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelected(row);
                      setNote("");
                    }}
                  >
                    <TableCell className="min-w-[220px]">
                      <div className="font-medium text-foreground">{agencyName(row)}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.website || row.contact_email || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{row.city || "-"}</div>
                      <div className="text-xs text-muted-foreground">{row.country || "-"}</div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{row.agency_type || "-"}</TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <div>{row.contact_person_name || "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.contact_person_email || row.contact_email || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge status={row.agency_verification_status} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {row.verification_submitted_at
                        ? formatDistanceToNow(new Date(row.verification_submitted_at), {
                            addSuffix: true,
                          })
                        : "-"}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end">
                        <AgencyActions
                          row={row}
                          onView={() => {
                            setSelected(row);
                            setNote("");
                          }}
                          onApprove={() => act("approve", row)}
                          onReject={() => {
                            setSelected(row);
                            setNote("");
                          }}
                          onInfo={() => {
                            setSelected(row);
                            setNote("");
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
            {pageRows.map((row: Row) => (
              <div key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => {
                      setSelected(row);
                      setNote("");
                    }}
                  >
                    <div className="font-medium">{agencyName(row)}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.city || "-"}, {row.country || "-"}
                    </div>
                  </button>
                  <AgencyActions
                    row={row}
                    onView={() => {
                      setSelected(row);
                      setNote("");
                    }}
                    onApprove={() => act("approve", row)}
                    onReject={() => {
                      setSelected(row);
                      setNote("");
                    }}
                    onInfo={() => {
                      setSelected(row);
                      setNote("");
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminStatusBadge status={row.agency_verification_status} />
                  {row.agency_type ? <Badge variant="secondary">{row.agency_type}</Badge> : null}
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
                  {agencyName(selected)}
                  <AdminStatusBadge status={selected.agency_verification_status} />
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <DetailGroup title="Company Information">
                  <AdminDetailItem label="Legal Name" value={selected.legal_company_name} />
                  <AdminDetailItem label="Trade Name" value={selected.trade_name} />
                  <AdminDetailItem label="Country" value={selected.country} />
                  <AdminDetailItem label="City" value={selected.city} />
                  <AdminDetailItem label="Address" value={selected.full_address} />
                  <AdminDetailItem label="Website" value={selected.website} />
                  <AdminDetailItem label="Year Established" value={selected.year_established} />
                  <AdminDetailItem label="Employees" value={selected.employees_count} />
                </DetailGroup>

                <DetailGroup title="Business Registration">
                  <AdminDetailItem label="CR Number" value={selected.cr_number} />
                  <AdminDetailItem
                    label="CR Expiry"
                    value={formatAdminDate(selected.cr_expiry_date)}
                  />
                  <AdminDetailItem label="Issuing Authority" value={selected.issuing_authority} />
                  <AdminDetailItem
                    label="Tourism License"
                    value={selected.tourism_license_number}
                  />
                  <div className="sm:col-span-2 flex flex-wrap gap-2">
                    <DocButton
                      label="Commercial Registration"
                      path={selected.cr_document_path}
                      get={getDocUrl}
                    />
                    <DocButton
                      label="Tourism License"
                      path={selected.tourism_license_document_path}
                      get={getDocUrl}
                    />
                  </div>
                </DetailGroup>

                <DetailGroup title="Contact Person">
                  <AdminDetailItem label="Name" value={selected.contact_person_name} />
                  <AdminDetailItem label="Position" value={selected.contact_person_position} />
                  <AdminDetailItem label="Email" value={selected.contact_person_email} />
                  <AdminDetailItem label="Phone" value={selected.contact_person_phone} />
                  <AdminDetailItem label="WhatsApp" value={selected.contact_person_whatsapp} />
                </DetailGroup>

                <DetailGroup title="Business and Billing">
                  <AdminDetailItem label="Agency Type" value={selected.agency_type} />
                  <AdminDetailItem label="Annual Bookings" value={selected.annual_group_bookings} />
                  <AdminDetailItem
                    label="Average Rooms / Booking"
                    value={selected.avg_rooms_per_booking}
                  />
                  <AdminDetailItem label="Legal Billing Name" value={selected.legal_billing_name} />
                  <AdminDetailItem label="VAT" value={selected.vat_billing_number} />
                  <AdminDetailItem label="Billing Email" value={selected.billing_email} />
                  <AdminDetailItem label="Billing Address" value={selected.billing_address} />
                </DetailGroup>

                <DetailGroup title="Verification History">
                  {events.length === 0 ? (
                    <div className="sm:col-span-2 text-xs text-muted-foreground">
                      No events yet.
                    </div>
                  ) : (
                    <ul className="sm:col-span-2 space-y-2">
                      {events.map((event) => (
                        <li
                          key={event.id}
                          className="rounded-md border border-border bg-surface/60 p-3 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <AdminStatusBadge status={String(event.event_type).replace("_", " ")} />
                            <span className="ml-auto text-muted-foreground">
                              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          {event.notes ? (
                            <div className="mt-2 text-foreground">
                              <span className="font-medium">Reason:</span> {event.notes}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </DetailGroup>

                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <MessageSquare className="h-3 w-3" /> Review note / rejection reason
                  </label>
                  <Textarea
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Required for Reject / Request more info"
                  />
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2">
                <Button variant="outline" onClick={() => act("info")} disabled={busy}>
                  Request more info
                </Button>
                <Button variant="destructive" onClick={() => act("reject")} disabled={busy}>
                  Reject
                </Button>
                <Button variant="gold" onClick={() => act("approve")} disabled={busy}>
                  Approve
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminManagementPage>
  );
}

function AgencyActions({
  row,
  onView,
  onApprove,
  onReject,
  onInfo,
}: {
  row: Row;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
  onInfo: () => void;
}) {
  const verified = row.agency_verification_status === "verified";
  return (
    <AdminActionMenu
      items={[
        { label: "View Details", icon: Eye, onSelect: onView },
        { label: "Approve", icon: CheckCircle2, onSelect: onApprove, disabled: verified },
        { label: "Reject", icon: XCircle, onSelect: onReject },
        { label: "Request More Information", icon: MessageSquare, onSelect: onInfo },
      ]}
    />
  );
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <AdminDetailGrid>{children}</AdminDetailGrid>
    </div>
  );
}

function DocButton({
  label,
  path,
  get,
}: {
  label: string;
  path?: string | null;
  get: (p?: string | null) => Promise<string | null>;
}) {
  const [loading, setLoading] = useState(false);
  if (!path)
    return (
      <Badge variant="secondary" className="opacity-60">
        {label}: not uploaded
      </Badge>
    );
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const url = await get(path);
        setLoading(false);
        if (url) window.open(url, "_blank");
        else toast.error("Could not open document");
      }}
    >
      <FileText className="h-4 w-4" /> {label}
    </Button>
  );
}

function agencyName(row: Row) {
  return (
    row.legal_company_name ||
    row.trade_name ||
    row.company_name ||
    row.org_name ||
    row.full_name ||
    "Untitled agency"
  );
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}
