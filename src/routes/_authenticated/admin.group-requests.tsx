import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Calendar, FileText, Loader2, MapPin, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/group-requests")({
  head: () => ({ meta: [{ title: "Group Requests - Admin" }] }),
  component: Page,
});

type Rfq = Database["public"]["Tables"]["rfqs"]["Row"];
type RfqStatus = Rfq["status"];
type Filter = "all" | RfqStatus;

const statusFilters: Filter[] = ["all", "draft", "open", "awarded", "closed", "cancelled"];

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-success/15 text-success",
  quoting: "bg-info/15 text-info",
  under_review: "bg-warning/15 text-warning",
  awarded: "bg-gold/20 text-gold-foreground border border-gold/30",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-error/15 text-error",
};

function Page() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-group-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfqs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredRows = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.status === filter)),
    [filter, rows],
  );

  const counts = useMemo(() => {
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      acc.all = (acc.all ?? 0) + 1;
      return acc;
    }, { all: 0 });
  }, [rows]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <FileText className="h-7 w-7" /> Group Requests
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Review all marketplace RFQs submitted by agencies.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
              filter === item ? "border-gold bg-gold/10 text-foreground" : "border-input text-muted-foreground"
            }`}
          >
            {item.replace("_", " ")} ({counts[item] ?? 0})
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading group requests...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-error">Could not load group requests.</CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Requests Available"
          description="No group accommodation requests match this filter."
        />
      ) : (
        <div className="space-y-3">
          {filteredRows.map((request) => (
            <Card key={request.id} className="hover:shadow-[var(--shadow-elevated)] transition">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-display text-lg text-primary truncate">{request.title}</h2>
                      <Badge className={statusColor[request.status] ?? "bg-muted text-muted-foreground"}>
                        {request.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {request.destination_city}, {request.destination_country}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(request.check_in)} - {formatDate(request.check_out)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {request.guests_count} guests / {request.rooms_needed} rooms
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(request.hotel_categories_v2?.length ? request.hotel_categories_v2 : ["Any category"]).map((category) => (
                        <Badge key={category} variant="secondary">{category}</Badge>
                      ))}
                    </div>
                    {request.requirements ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground line-clamp-3">{request.requirements}</p>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}
