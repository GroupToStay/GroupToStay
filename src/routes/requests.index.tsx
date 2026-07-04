import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar, Users, ArrowRight, Inbox } from "lucide-react";
import { useRoles } from "@/hooks/use-role";
import { EmptyState } from "@/components/empty-state";
import { useApplicationLocale } from "@/lib/application-locale";

export const Route = createFileRoute("/requests/")({
  head: () => ({
    meta: [
      { title: "Open group requests — GroupToStay" },
      {
        name: "description",
        content:
          "Browse open group accommodation requests from organizers worldwide. Hotels can respond directly to win the booking.",
      },
      { property: "og:title", content: "Open group requests — GroupToStay" },
      {
        property: "og:description",
        content:
          "Live Group Requests from travel agencies. Hotels: respond and message the agency to close the deal.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const { isOrganizer, loading } = useRoles();
  const { compare, formatDate } = useApplicationLocale();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("__any");
  const [type, setType] = useState("__any");

  const { data: rfqs = [] } = useQuery({
    queryKey: ["public-requests"],
    enabled: !loading && !isOrganizer,
    queryFn: async () => {
      const { data } = await supabase
        .from("rfqs")
        .select(
          "id,title,group_type,destination_city,destination_country,check_in,check_out,nights,guests_count,rooms_needed,board_type,deadline,created_at",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const cities = useMemo(
    () => Array.from(new Set(rfqs.map((r) => r.destination_city))).sort(compare),
    [compare, rfqs],
  );
  const types = useMemo(
    () => Array.from(new Set(rfqs.map((r) => r.group_type))).sort(compare),
    [compare, rfqs],
  );
  const filtered = rfqs.filter((r) => {
    if (city !== "__any" && r.destination_city !== city) return false;
    if (type !== "__any" && r.group_type !== type) return false;
    if (
      q &&
      !`${r.title} ${r.destination_city} ${r.destination_country}`
        .toLowerCase()
        .includes(q.toLowerCase())
    )
      return false;
    return true;
  });

  if (!loading && isOrganizer) {
    return <Navigate to="/dashboard/rfqs" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground">
          <div className="container-page py-14">
            <h1 className="font-display text-4xl">Open group requests</h1>
            <p className="mt-2 text-primary-foreground/80">
              Live Group Requests from agencies. Hotels — review and message the agency to win the
              deal.
            </p>
          </div>
        </section>

        <div className="container-page py-6 grid md:grid-cols-[1fr_200px_200px] gap-3 sticky top-16 bg-background z-30 border-b border-border">
          <Input
            placeholder="Search by destination, title…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger>
              <SelectValue placeholder="Destination" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any">Any destination</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="Group type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any">Any type</SelectItem>
              {types.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="container-page py-10">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No open requests right now"
              description="New group requests appear here as agencies post them. Check back soon or update your hotel profile so you're matched automatically."
              actionLabel="Go to dashboard"
              actionTo="/dashboard"
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((r) => (
                <Link key={r.id} to="/requests/$id" params={{ id: r.id }}>
                  <Card className="h-full hover:shadow-[var(--shadow-elevated)] transition border-border">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge className="bg-success/15 text-success border-0 uppercase tracking-wide">
                          {r.group_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(r.created_at)}
                        </span>
                      </div>
                      <h3 className="font-display text-lg text-primary line-clamp-2">{r.title}</h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> {r.destination_city},{" "}
                          {r.destination_country}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" /> {r.check_in} → {r.check_out} (
                          {r.nights}n)
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> {r.guests_count} guests ·{" "}
                          {r.rooms_needed} rooms
                        </div>
                      </div>
                      <div className="pt-2 text-sm text-primary font-medium inline-flex items-center gap-1">
                        View & respond <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
