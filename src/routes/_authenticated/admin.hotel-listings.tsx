import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, CheckCircle2, Eye, Hotel, Loader2, Search, ShieldAlert } from "lucide-react";
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
import { HotelPhoto } from "@/components/hotel-photo";
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
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/hotel-listings")({
  head: () => ({ meta: [{ title: "Hotel Listings - Admin" }] }),
  component: Page,
});

type HotelStatus = "pending" | "approved" | "suspended";
type HotelRow = Database["public"]["Tables"]["hotels"]["Row"];
type HotelPatch = Database["public"]["Tables"]["hotels"]["Update"];

const statusOptions: { value: HotelStatus; label: string }[] = [
  { value: "pending", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "suspended", label: "Suspended" },
];

function Page() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<HotelStatus>("pending");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HotelRow | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-hotels", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select(
          "id, name, city, country, star_rating, status, cover_image, description, created_at, archived, owner_id",
        )
        .eq("status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HotelRow[];
    },
  });

  const setStatusFor = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: "approved" | "suspended" }) => {
      const patch: HotelPatch = { status: next };
      if (next === "suspended") {
        patch.archived = true;
        patch.owner_id = null;
      }
      const { error } = await supabase.from("hotels").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decision saved");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-hotels"] });
    },
    onError: (e: unknown) => toast.error(errorMessage(e, "Decision failed")),
  });

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row: HotelRow) =>
      [row.name, row.city, row.country, row.star_rating, row.status]
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [query, rows]);

  useEffect(() => {
    setPage(1);
  }, [query, status, pageSize]);

  const pageRows = getPageSlice(filteredRows, page, pageSize);

  return (
    <AdminManagementPage
      title="Hotel Listings"
      description="Approve, suspend and review individual hotel properties."
      icon={Hotel}
    >
      <AdminToolbar>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder="Search hotel, city, country or rating"
          />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as HotelStatus)}>
          <SelectTrigger className="w-full lg:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
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
            setStatus("pending");
          }}
        >
          Reset Filters
        </Button>
      </AdminToolbar>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading hotel listings...
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={Hotel}
          title="No Hotel Listings"
          description="No hotel listings match these filters yet."
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
                  <TableHead>Hotel</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="hidden lg:table-cell">Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row: HotelRow) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(row)}
                  >
                    <TableCell className="min-w-[240px]">
                      <div className="flex items-center gap-3">
                        {row.cover_image ? (
                          <HotelPhoto
                            src={row.cover_image}
                            alt=""
                            className="h-10 w-14 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded-md bg-muted">
                            <Building2 className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{row.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {row.description || "No description"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{row.city || "-"}</div>
                      <div className="text-xs text-muted-foreground">{row.country || "-"}</div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {row.star_rating ? `${row.star_rating} stars` : "-"}
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {formatAdminDate(row.created_at)}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end">
                        <HotelActions
                          row={row}
                          onView={() => setSelected(row)}
                          onOpen={() => window.open(`/hotels/${row.id}`, "_blank")}
                          onApprove={() => setStatusFor.mutate({ id: row.id, next: "approved" })}
                          onSuspend={() => setStatusFor.mutate({ id: row.id, next: "suspended" })}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y divide-border md:hidden">
            {pageRows.map((row: HotelRow) => (
              <div key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => setSelected(row)}
                  >
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.city || "-"}, {row.country || "-"}
                    </div>
                  </button>
                  <HotelActions
                    row={row}
                    onView={() => setSelected(row)}
                    onOpen={() => window.open(`/hotels/${row.id}`, "_blank")}
                    onApprove={() => setStatusFor.mutate({ id: row.id, next: "approved" })}
                    onSuspend={() => setStatusFor.mutate({ id: row.id, next: "suspended" })}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminStatusBadge status={row.status} />
                  <span className="text-xs text-muted-foreground">
                    {row.star_rating ? `${row.star_rating} stars` : "No rating"}
                  </span>
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
                  {selected.name}
                  <AdminStatusBadge status={selected.status} />
                </DialogTitle>
              </DialogHeader>

              {selected.cover_image ? (
                <HotelPhoto
                  src={selected.cover_image}
                  alt=""
                  className="max-h-64 w-full rounded-lg border border-border object-cover"
                />
              ) : null}

              <AdminDetailGrid>
                <AdminDetailItem label="Hotel Name" value={selected.name} />
                <AdminDetailItem label="City" value={selected.city} />
                <AdminDetailItem label="Country" value={selected.country} />
                <AdminDetailItem
                  label="Rating"
                  value={selected.star_rating ? `${selected.star_rating} stars` : "-"}
                />
                <AdminDetailItem
                  label="Status"
                  value={<AdminStatusBadge status={selected.status} />}
                />
                <AdminDetailItem label="Archived" value={selected.archived ? "Yes" : "No"} />
                <AdminDetailItem label="Owner ID" value={selected.owner_id || "-"} />
                <AdminDetailItem label="Created" value={formatAdminDate(selected.created_at)} />
              </AdminDetailGrid>

              <div className="rounded-md border border-border bg-surface/60 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {selected.description || "No description provided."}
                </p>
              </div>

              <DialogFooter className="flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(`/hotels/${selected.id}`, "_blank")}
                >
                  <Eye className="h-4 w-4" /> View Hotel
                </Button>
                {selected.status === "approved" ? (
                  <AdminStatusBadge status="locked" />
                ) : selected.status === "suspended" ? (
                  <AdminStatusBadge status="archived" />
                ) : (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => setStatusFor.mutate({ id: selected.id, next: "suspended" })}
                    >
                      <ShieldAlert className="h-4 w-4" /> Suspend
                    </Button>
                    <Button
                      variant="gold"
                      onClick={() => setStatusFor.mutate({ id: selected.id, next: "approved" })}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve
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

function HotelActions({
  row,
  onView,
  onOpen,
  onApprove,
  onSuspend,
}: {
  row: HotelRow;
  onView: () => void;
  onOpen: () => void;
  onApprove: () => void;
  onSuspend: () => void;
}) {
  const approved = row.status === "approved";
  const suspended = row.status === "suspended";
  return (
    <AdminActionMenu
      items={[
        { label: "View Details", icon: Eye, onSelect: onView },
        { label: "Open Hotel Page", icon: Hotel, onSelect: onOpen },
        {
          label: "Approve",
          icon: CheckCircle2,
          onSelect: onApprove,
          disabled: approved || suspended,
          separatorBefore: true,
        },
        {
          label: "Suspend",
          icon: ShieldAlert,
          onSelect: onSuspend,
          disabled: approved || suspended,
          destructive: true,
        },
      ]}
    />
  );
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}
