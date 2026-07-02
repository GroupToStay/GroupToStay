import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Mail, Phone, ShieldCheck, UserRound, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users - Admin" }] }),
  component: Page,
});

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Role = Database["public"]["Tables"]["user_roles"]["Row"]["role"];
type RoleFilter = "all" | Role;
type UserRow = {
  user_id: string;
  role: Role;
  created_at: string;
  profile?: Profile;
};

const roleFilters: RoleFilter[] = ["all", "admin", "organizer", "hotel"];

const roleColor: Record<Role, string> = {
  admin: "bg-primary text-primary-foreground",
  organizer: "bg-success/15 text-success",
  hotel: "bg-gold/20 text-gold-foreground border border-gold/30",
};

function Page() {
  const [filter, setFilter] = useState<RoleFilter>("all");

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (rolesError) throw rolesError;
      const userIds = [...new Set((roles ?? []).map((role) => role.user_id))];

      let profiles: Profile[] = [];
      if (userIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);

        if (profilesError) throw profilesError;
        profiles = profileRows ?? [];
      }

      const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
      return (roles ?? []).map((role) => ({
        user_id: role.user_id,
        role: role.role,
        created_at: role.created_at,
        profile: profileById.get(role.user_id),
      })) satisfies UserRow[];
    },
  });

  const filteredRows = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.role === filter)),
    [filter, rows],
  );

  const counts = useMemo(() => {
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.role] = (acc[row.role] ?? 0) + 1;
      acc.all = (acc.all ?? 0) + 1;
      return acc;
    }, { all: 0 });
  }, [rows]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Users className="h-7 w-7" /> Users
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Review platform user accounts and role assignments.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {roleFilters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
              filter === item ? "border-gold bg-gold/10 text-foreground" : "border-input text-muted-foreground"
            }`}
          >
            {roleLabel(item)} ({counts[item] ?? 0})
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-error">Could not load users.</CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <EmptyState icon={UserRound} title="No Users Found" description="No user accounts match this filter." />
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <Card key={`${row.user_id}-${row.role}`} className="hover:shadow-[var(--shadow-elevated)] transition">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-display text-lg text-primary truncate">{displayName(row.profile)}</h2>
                      <Badge className={roleColor[row.role]}>{roleLabel(row.role)}</Badge>
                      <VerificationBadge profile={row.profile} role={row.role} />
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                      <span className="flex items-center gap-1 min-w-0">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{contactEmail(row.profile)}</span>
                      </span>
                      <span className="flex items-center gap-1 min-w-0">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{row.profile?.phone_number || row.profile?.phone || "No phone"}</span>
                      </span>
                      <span className="flex items-center gap-1 min-w-0">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{row.profile?.country || "No country"}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
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

function displayName(profile?: Profile) {
  return (
    profile?.legal_company_name ||
    profile?.trade_name ||
    profile?.company_name ||
    profile?.org_name ||
    profile?.full_name ||
    "Unnamed user"
  );
}

function contactEmail(profile?: Profile) {
  return profile?.contact_email || profile?.contact_person_email || profile?.billing_email || "No email on profile";
}

function roleLabel(role: RoleFilter) {
  if (role === "all") return "All";
  if (role === "organizer") return "Agency";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function VerificationBadge({ profile, role }: { profile?: Profile; role: Role }) {
  if (!profile) return null;
  const status = role === "organizer" ? profile.agency_verification_status : role === "hotel" ? profile.hotel_approval_status : null;
  if (!status) return null;

  const cls =
    status === "verified" || status === "approved"
      ? "bg-success/15 text-success"
      : status === "rejected"
        ? "bg-error/15 text-error"
        : "bg-muted text-muted-foreground";

  return <Badge className={cls}>{String(status).replace("_", " ")}</Badge>;
}
