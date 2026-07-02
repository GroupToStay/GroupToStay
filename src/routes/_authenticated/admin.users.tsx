import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Activity, Edit, Eye, KeyRound, Loader2, Mail, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users - Admin" }] }),
  component: Page,
});

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = Database["public"]["Tables"]["user_roles"]["Row"]["role"];
type RoleFilter = "all" | "visitor" | AppRole;
type AccountStatus = "active" | "suspended" | "disabled";
type VerificationFilter = "all" | "verified" | "pending" | "rejected" | "draft" | "unverified";
type UserDialog =
  | { type: "profile"; row: UserRow }
  | { type: "edit"; row: UserRow }
  | { type: "activity"; row: UserRow }
  | { type: "verification"; row: UserRow }
  | null;

type ProfileWithStatus = Profile & {
  account_status?: AccountStatus | null;
  avatar_url?: string | null;
};

type UserRow = {
  user_id: string;
  roles: AppRole[];
  roleLabel: string;
  profile?: ProfileWithStatus;
  created_at: string;
};

const roleFilters: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All Roles" },
  { value: "visitor", label: "Visitors" },
  { value: "organizer", label: "Agencies" },
  { value: "hotel", label: "Hotels" },
  { value: "admin", label: "Administrators" },
];

const verificationFilters: { value: VerificationFilter; label: string }[] = [
  { value: "all", label: "All Verification" },
  { value: "verified", label: "Verified / Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
  { value: "unverified", label: "Unverified" },
];

const accountFilters: { value: "all" | AccountStatus; label: string }[] = [
  { value: "all", label: "All Account Status" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "disabled", label: "Disabled" },
];

const roleColor: Record<string, string> = {
  admin: "bg-primary text-primary-foreground",
  organizer: "bg-success/15 text-success",
  hotel: "bg-gold/20 text-gold-foreground border border-gold/30",
  visitor: "bg-muted text-muted-foreground",
};

const accountColor: Record<AccountStatus, string> = {
  active: "bg-success/15 text-success",
  suspended: "bg-warning/15 text-warning",
  disabled: "bg-error/15 text-error",
};

function Page() {
  const qc = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
  const [accountFilter, setAccountFilter] = useState<"all" | AccountStatus>("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<UserDialog>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-user-management"],
    queryFn: async () => {
      const [rolesResult, profilesResult] = await Promise.all([
        supabase.from("user_roles").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      ]);

      if (rolesResult.error) throw rolesResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const rolesByUser = new Map<string, AppRole[]>();
      const roleCreatedByUser = new Map<string, string>();
      (rolesResult.data ?? []).forEach((role) => {
        rolesByUser.set(role.user_id, [...(rolesByUser.get(role.user_id) ?? []), role.role]);
        if (!roleCreatedByUser.has(role.user_id)) roleCreatedByUser.set(role.user_id, role.created_at);
      });

      const profiles = (profilesResult.data ?? []) as ProfileWithStatus[];
      const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
      const userIds = new Set<string>([
        ...profiles.map((profile) => profile.id),
        ...(rolesResult.data ?? []).map((role) => role.user_id),
      ]);

      return [...userIds].map((user_id) => {
        const roles = rolesByUser.get(user_id) ?? [];
        const profile = profileById.get(user_id);
        return {
          user_id,
          roles,
          roleLabel: roles.length ? roles.map(roleLabel).join(", ") : "Visitor",
          profile,
          created_at: profile?.created_at ?? roleCreatedByUser.get(user_id) ?? new Date(0).toISOString(),
        };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) satisfies UserRow[];
    },
  });

  const updateAccountStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AccountStatus }) => {
      const { error } = await supabase.from("profiles").update({ account_status: status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account status updated");
      qc.invalidateQueries({ queryKey: ["admin-user-management"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not update account status"),
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, string | null> }) => {
      const { error } = await supabase.from("profiles").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      setDialog(null);
      qc.invalidateQueries({ queryKey: ["admin-user-management"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not update profile"),
  });

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Password reset email sent"),
    onError: (err: any) => toast.error(err?.message ?? "Password reset failed"),
  });

  const countries = useMemo(() => {
    return [...new Set(rows.map((row) => row.profile?.country).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (roleFilter !== "all") {
        if (roleFilter === "visitor" && row.roles.length > 0) return false;
        if (roleFilter !== "visitor" && !row.roles.includes(roleFilter)) return false;
      }
      if (countryFilter !== "all" && row.profile?.country !== countryFilter) return false;
      if (accountFilter !== "all" && accountStatus(row.profile) !== accountFilter) return false;
      if (verificationFilter !== "all" && verificationStatusKey(row) !== verificationFilter) return false;
      if (!text) return true;
      return [
        displayName(row.profile),
        companyName(row.profile),
        contactEmail(row.profile),
        row.profile?.phone_number,
        row.profile?.phone,
        row.user_id,
      ].join(" ").toLowerCase().includes(text);
    });
  }, [accountFilter, countryFilter, query, roleFilter, rows, verificationFilter]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Users className="h-7 w-7" /> User Management
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Registered accounts, roles, verification state and account status.</p>
      </header>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Search by name, email, company or phone"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roleFilters.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map((country) => <SelectItem key={country} value={country}>{country}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={verificationFilter} onValueChange={(value) => setVerificationFilter(value as VerificationFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{verificationFilters.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={accountFilter} onValueChange={(value) => setAccountFilter(value as "all" | AccountStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{accountFilters.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading users...</CardContent></Card>
      ) : error ? (
        <Card><CardContent className="p-6 text-sm text-error">Could not load user management data.</CardContent></Card>
      ) : filteredRows.length === 0 ? (
        <EmptyState icon={UserRound} title="No Users Found" description="No registered accounts match these filters." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const email = contactEmail(row.profile);
                  const status = accountStatus(row.profile);
                  return (
                    <TableRow key={row.user_id}>
                      <TableCell>
                        <Avatar>
                          <AvatarImage src={row.profile?.avatar_url ?? undefined} alt={displayName(row.profile)} />
                          <AvatarFallback>{initials(row.profile)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="min-w-[160px] font-medium">{displayName(row.profile)}</TableCell>
                      <TableCell className="min-w-[160px]">{companyName(row.profile)}</TableCell>
                      <TableCell className="min-w-[180px]">{email}</TableCell>
                      <TableCell>{row.profile?.phone_number || row.profile?.phone || "-"}</TableCell>
                      <TableCell><RoleBadges row={row} /></TableCell>
                      <TableCell><VerificationBadge row={row} /></TableCell>
                      <TableCell><Badge className={accountColor[status]}>{status}</Badge></TableCell>
                      <TableCell>{row.profile?.country || "-"}</TableCell>
                      <TableCell>{formatDate(row.created_at)}</TableCell>
                      <TableCell><span className="text-muted-foreground">Auth Admin required</span></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setDialog({ type: "profile", row })}><Eye className="h-4 w-4" /> View</Button>
                          <Button size="sm" variant="outline" disabled={!row.profile} onClick={() => setDialog({ type: "edit", row })}><Edit className="h-4 w-4" /> Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => setDialog({ type: "activity", row })}><Activity className="h-4 w-4" /> Activity</Button>
                          <Button size="sm" variant="outline" onClick={() => setDialog({ type: "verification", row })}><ShieldCheck className="h-4 w-4" /> Verification</Button>
                          {status !== "suspended" ? (
                            <Button size="sm" variant="outline" disabled={!row.profile} onClick={() => updateAccountStatus.mutate({ id: row.user_id, status: "suspended" })}>Suspend</Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled={!row.profile} onClick={() => updateAccountStatus.mutate({ id: row.user_id, status: "active" })}>Activate</Button>
                          )}
                          <Button size="sm" variant="outline" disabled={!row.profile || status === "disabled"} onClick={() => updateAccountStatus.mutate({ id: row.user_id, status: "disabled" })}>Disable</Button>
                          <Button size="sm" variant="outline" disabled={!email || email === "-"} onClick={() => resetPassword.mutate(email)}><KeyRound className="h-4 w-4" /> Reset</Button>
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

      <UserDialogContent
        dialog={dialog}
        onOpenChange={(open) => !open && setDialog(null)}
        onSave={(id, patch) => updateProfile.mutate({ id, patch })}
      />
    </section>
  );
}

function UserDialogContent({ dialog, onOpenChange, onSave }: { dialog: UserDialog; onOpenChange: (open: boolean) => void; onSave: (id: string, patch: Record<string, string | null>) => void }) {
  const row = dialog?.row;
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (dialog?.type !== "edit" || !row?.profile) {
      setDraft({});
      return;
    }
    setDraft({
      full_name: row.profile.full_name ?? "",
      company_name: row.profile.company_name ?? "",
      contact_email: row.profile.contact_email ?? "",
      phone_number: row.profile.phone_number ?? "",
      country: row.profile.country ?? "",
    });
  }, [dialog?.type, row?.profile, row?.user_id]);

  return (
    <Dialog open={!!dialog} onOpenChange={(open) => { if (!open) setDraft({}); onOpenChange(open); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {dialog?.type === "profile" && row ? (
          <>
            <DialogHeader>
              <DialogTitle>{displayName(row.profile)}</DialogTitle>
              <DialogDescription>User ID: {row.user_id}</DialogDescription>
            </DialogHeader>
            <ProfileDetails row={row} />
          </>
        ) : null}

        {dialog?.type === "edit" && row?.profile ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit User Profile</DialogTitle>
              <DialogDescription>Update public profile fields for this account.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {["full_name", "company_name", "contact_email", "phone_number", "country"].map((field) => (
                <label key={field} className="text-sm">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{field.replace("_", " ")}</span>
                  <Input value={draft[field] ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, [field]: event.target.value }))} />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="gold" onClick={() => onSave(row.user_id, draft)}>Save</Button>
            </div>
          </>
        ) : null}

        {dialog?.type === "activity" && row ? (
          <>
            <DialogHeader>
              <DialogTitle>Activity - {displayName(row.profile)}</DialogTitle>
              <DialogDescription>Recent activity summary from marketplace tables.</DialogDescription>
            </DialogHeader>
            <ActivitySummary userId={row.user_id} />
          </>
        ) : null}

        {dialog?.type === "verification" && row ? (
          <>
            <DialogHeader>
              <DialogTitle>Verification - {displayName(row.profile)}</DialogTitle>
              <DialogDescription>Verification and approval status for this account.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <Detail label="Role" value={row.roleLabel} />
              <Detail label="Agency Verification" value={row.profile?.agency_verification_status || "Not applicable"} />
              <Detail label="Hotel Approval" value={row.profile?.hotel_approval_status || "Not applicable"} />
              <Detail label="Trust Level" value={row.profile?.verification_trust_level || "Not assigned"} />
              <Detail label="Reviewed At" value={formatDate(row.profile?.verification_reviewed_at ?? null)} />
              <Detail label="Submitted At" value={formatDate(row.profile?.verification_submitted_at ?? null)} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ActivitySummary({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-activity", userId],
    queryFn: async () => {
      const [rfqs, hotels, messages, notifications, events] = await Promise.all([
        supabase.from("rfqs").select("id,status,created_at").eq("organizer_id", userId),
        supabase.from("hotels").select("id,status,created_at").eq("owner_id", userId),
        supabase.from("messages").select("id,created_at").eq("sender_id", userId).limit(50),
        supabase.from("notifications").select("id,created_at").eq("user_id", userId).limit(50),
        supabase.from("agency_verification_events").select("id,event_type,created_at").eq("agency_id", userId).limit(50),
      ]);
      return {
        rfqs: rfqs.data ?? [],
        hotels: hotels.data ?? [],
        messages: messages.data ?? [],
        notifications: notifications.data ?? [],
        events: events.data ?? [],
      };
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading activity...</div>;

  const cards = [
    { label: "RFQs Created", value: data?.rfqs.length ?? 0 },
    { label: "Hotels Owned", value: data?.hotels.length ?? 0 },
    { label: "Messages Sent", value: data?.messages.length ?? 0 },
    { label: "Notifications", value: data?.notifications.length ?? 0 },
    { label: "Verification Events", value: data?.events.length ?? 0 },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <div key={card.label} className="rounded-md border border-border p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{card.label}</div>
          <div className="mt-1 font-display text-2xl text-primary">{card.value}</div>
        </div>
      ))}
    </div>
  );
}

function ProfileDetails({ row }: { row: UserRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 text-sm">
      <Detail label="Full Name" value={displayName(row.profile)} />
      <Detail label="Company" value={companyName(row.profile)} />
      <Detail label="Email" value={contactEmail(row.profile)} />
      <Detail label="Phone" value={row.profile?.phone_number || row.profile?.phone || "-"} />
      <Detail label="Role" value={row.roleLabel} />
      <Detail label="Account Status" value={accountStatus(row.profile)} />
      <Detail label="Country" value={row.profile?.country || "-"} />
      <Detail label="Registration Date" value={formatDate(row.created_at)} />
      <Detail label="Last Login" value="Requires Supabase Auth Admin" />
      <Detail label="User ID" value={row.user_id} />
    </div>
  );
}

function RoleBadges({ row }: { row: UserRow }) {
  const roles = row.roles.length ? row.roles : ["visitor"];
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => <Badge key={role} className={roleColor[role] ?? roleColor.visitor}>{roleLabel(role as RoleFilter)}</Badge>)}
    </div>
  );
}

function VerificationBadge({ row }: { row: UserRow }) {
  const status = verificationLabel(row);
  const key = verificationStatusKey(row);
  const cls = key === "verified" ? "bg-success/15 text-success" : key === "rejected" ? "bg-error/15 text-error" : "bg-muted text-muted-foreground";
  return <Badge className={cls}>{status}</Badge>;
}

function verificationStatusKey(row: UserRow): VerificationFilter {
  if (row.roles.includes("organizer")) {
    const status = row.profile?.agency_verification_status;
    if (status === "verified") return "verified";
    if (status === "pending_review" || status === "submitted") return "pending";
    if (status === "rejected") return "rejected";
    if (status === "draft") return "draft";
    return "unverified";
  }
  if (row.roles.includes("hotel")) {
    const status = row.profile?.hotel_approval_status;
    if (status === "approved") return "verified";
    if (status === "pending") return "pending";
    if (status === "rejected") return "rejected";
    return "unverified";
  }
  return "unverified";
}

function verificationLabel(row: UserRow) {
  if (row.roles.includes("organizer")) return row.profile?.agency_verification_status?.replace("_", " ") || "unverified";
  if (row.roles.includes("hotel")) return row.profile?.hotel_approval_status || "unverified";
  return "not required";
}

function accountStatus(profile?: ProfileWithStatus): AccountStatus {
  return profile?.account_status ?? "active";
}

function displayName(profile?: ProfileWithStatus) {
  return profile?.full_name || profile?.legal_company_name || profile?.trade_name || profile?.company_name || profile?.org_name || "Unnamed user";
}

function companyName(profile?: ProfileWithStatus) {
  return profile?.legal_company_name || profile?.trade_name || profile?.company_name || profile?.org_name || "-";
}

function contactEmail(profile?: ProfileWithStatus) {
  return profile?.contact_email || profile?.contact_person_email || profile?.billing_email || "-";
}

function roleLabel(role: RoleFilter) {
  if (role === "all") return "All";
  if (role === "organizer") return "Agency";
  if (role === "hotel") return "Hotel";
  if (role === "admin") return "Admin";
  return "Visitor";
}

function initials(profile?: ProfileWithStatus) {
  const name = displayName(profile);
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const dateOnly = value.includes("T") ? value.slice(0, 10) : value;
  const [year, month, day] = dateOnly.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-foreground break-words">{value}</div>
    </div>
  );
}
