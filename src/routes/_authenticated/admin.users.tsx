import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Edit,
  Eye,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AdminActionMenu,
  AdminDetailGrid,
  AdminDetailItem,
  AdminManagementPage,
  AdminPagination,
  AdminRoleBadge,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users - Admin" }] }),
  component: Page,
});

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfilePatch = Database["public"]["Tables"]["profiles"]["Update"];
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

function Page() {
  const qc = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
  const [accountFilter, setAccountFilter] = useState<"all" | AccountStatus>("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<UserDialog>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery({
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
        if (!roleCreatedByUser.has(role.user_id))
          roleCreatedByUser.set(role.user_id, role.created_at);
      });

      const profiles = (profilesResult.data ?? []) as ProfileWithStatus[];
      const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
      const userIds = new Set<string>([
        ...profiles.map((profile) => profile.id),
        ...(rolesResult.data ?? []).map((role) => role.user_id),
      ]);

      return [...userIds]
        .map((user_id) => {
          const roles = rolesByUser.get(user_id) ?? [];
          const profile = profileById.get(user_id);
          return {
            user_id,
            roles,
            roleLabel: roles.length ? roles.map(roleLabel).join(", ") : "Visitor",
            profile,
            created_at:
              profile?.created_at ?? roleCreatedByUser.get(user_id) ?? new Date(0).toISOString(),
          };
        })
        .sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ) satisfies UserRow[];
    },
  });

  const updateAccountStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AccountStatus }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ account_status: status } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account status updated");
      qc.invalidateQueries({ queryKey: ["admin-user-management"] });
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Could not update account status")),
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, string | null> }) => {
      const { error } = await supabase
        .from("profiles")
        .update(patch as ProfilePatch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      setDialog(null);
      qc.invalidateQueries({ queryKey: ["admin-user-management"] });
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Could not update profile")),
  });

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Password reset email sent"),
    onError: (err: unknown) => toast.error(errorMessage(err, "Password reset failed")),
  });

  const countries = useMemo(() => {
    return [...new Set(rows.map((row) => row.profile?.country).filter(Boolean) as string[])].sort(
      (a, b) => a.localeCompare(b),
    );
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
      if (verificationFilter !== "all" && verificationStatusKey(row) !== verificationFilter)
        return false;
      if (!text) return true;
      return [
        displayName(row.profile),
        companyName(row.profile),
        contactEmail(row.profile),
        row.profile?.phone_number,
        row.profile?.phone,
        row.user_id,
      ]
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [accountFilter, countryFilter, query, roleFilter, rows, verificationFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, countryFilter, verificationFilter, accountFilter, pageSize]);

  const pageRows = getPageSlice(filteredRows, page, pageSize);
  const roleCounts = useMemo(() => {
    return {
      all: rows.length,
      agencies: rows.filter((row) => row.roles.includes("organizer")).length,
      hotels: rows.filter((row) => row.roles.includes("hotel")).length,
      admins: rows.filter((row) => row.roles.includes("admin")).length,
      active: rows.filter((row) => accountStatus(row.profile) === "active").length,
    };
  }, [rows]);

  const metrics: AdminMetric[] = [
    {
      label: "All Users",
      value: formatCompactNumber(roleCounts.all),
      description: "Registered accounts",
      icon: Users,
      tone: "info",
    },
    {
      label: "Agencies",
      value: formatCompactNumber(roleCounts.agencies),
      description: "Marketplace buyers",
      icon: UserCheck,
      tone: "success",
    },
    {
      label: "Hotels",
      value: formatCompactNumber(roleCounts.hotels),
      description: "Marketplace suppliers",
      icon: UserRound,
      tone: "gold",
    },
    {
      label: "Admins",
      value: formatCompactNumber(roleCounts.admins),
      description: "Management users",
      icon: ShieldCheck,
      tone: "purple",
    },
    {
      label: "Active",
      value: formatCompactNumber(roleCounts.active),
      description: "Current active accounts",
      icon: UserCheck,
      tone: "success",
    },
  ];

  return (
    <AdminManagementPage
      title="User Management"
      description="Manage all registered users, roles, verification state and account status."
      icon={Users}
      metrics={metrics}
    >
      <AdminToolbar>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder="Search by name, email, company or phone"
          />
        </div>
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
          <SelectTrigger className="w-full lg:w-[155px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleFilters.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-full lg:w-[170px]">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={verificationFilter}
          onValueChange={(value) => setVerificationFilter(value as VerificationFilter)}
        >
          <SelectTrigger className="w-full lg:w-[175px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {verificationFilters.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={accountFilter}
          onValueChange={(value) => setAccountFilter(value as "all" | AccountStatus)}
        >
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accountFilters.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => {
            setQuery("");
            setRoleFilter("all");
            setCountryFilter("all");
            setVerificationFilter("all");
            setAccountFilter("all");
          }}
        >
          Reset Filters
        </Button>
      </AdminToolbar>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-error">
            Could not load user management data.
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No Users Found"
          description="No registered accounts match these filters."
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
                  <TableHead>User</TableHead>
                  <TableHead className="hidden xl:table-cell">Company</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="hidden xl:table-cell">Country</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => {
                  const email = contactEmail(row.profile);
                  const status = accountStatus(row.profile);
                  return (
                    <TableRow
                      key={row.user_id}
                      className="cursor-pointer"
                      onClick={() => setDialog({ type: "profile", row })}
                    >
                      <TableCell className="min-w-[230px]">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage
                              src={row.profile?.avatar_url ?? undefined}
                              alt={displayName(row.profile)}
                            />
                            <AvatarFallback>{initials(row.profile)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {displayName(row.profile)}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">{email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {companyName(row.profile)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {row.profile?.phone_number || row.profile?.phone || "-"}
                      </TableCell>
                      <TableCell>
                        <RoleBadges row={row} />
                      </TableCell>
                      <TableCell>
                        <AdminStatusBadge status={verificationLabel(row)} />
                      </TableCell>
                      <TableCell>
                        <AdminStatusBadge status={status} />
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {row.profile?.country || "-"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {formatAdminDate(row.created_at)}
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end">
                          <UserActions
                            row={row}
                            email={email}
                            status={status}
                            onProfile={() => setDialog({ type: "profile", row })}
                            onEdit={() => setDialog({ type: "edit", row })}
                            onActivity={() => setDialog({ type: "activity", row })}
                            onVerification={() => setDialog({ type: "verification", row })}
                            onSuspend={() =>
                              updateAccountStatus.mutate({ id: row.user_id, status: "suspended" })
                            }
                            onActivate={() =>
                              updateAccountStatus.mutate({ id: row.user_id, status: "active" })
                            }
                            onDisable={() =>
                              updateAccountStatus.mutate({ id: row.user_id, status: "disabled" })
                            }
                            onReset={() => resetPassword.mutate(email)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y divide-border md:hidden">
            {pageRows.map((row) => {
              const email = contactEmail(row.profile);
              const status = accountStatus(row.profile);
              return (
                <div key={row.user_id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-3 text-left"
                      onClick={() => setDialog({ type: "profile", row })}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage
                          src={row.profile?.avatar_url ?? undefined}
                          alt={displayName(row.profile)}
                        />
                        <AvatarFallback>{initials(row.profile)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {displayName(row.profile)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {email}
                        </span>
                      </span>
                    </button>
                    <UserActions
                      row={row}
                      email={email}
                      status={status}
                      onProfile={() => setDialog({ type: "profile", row })}
                      onEdit={() => setDialog({ type: "edit", row })}
                      onActivity={() => setDialog({ type: "activity", row })}
                      onVerification={() => setDialog({ type: "verification", row })}
                      onSuspend={() =>
                        updateAccountStatus.mutate({ id: row.user_id, status: "suspended" })
                      }
                      onActivate={() =>
                        updateAccountStatus.mutate({ id: row.user_id, status: "active" })
                      }
                      onDisable={() =>
                        updateAccountStatus.mutate({ id: row.user_id, status: "disabled" })
                      }
                      onReset={() => resetPassword.mutate(email)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <RoleBadges row={row} />
                    <AdminStatusBadge status={verificationLabel(row)} />
                    <AdminStatusBadge status={status} />
                  </div>
                </div>
              );
            })}
          </div>
        </AdminTableCard>
      )}

      <UserDialogContent
        dialog={dialog}
        onOpenChange={(open) => !open && setDialog(null)}
        onSave={(id, patch) => updateProfile.mutate({ id, patch })}
      />
    </AdminManagementPage>
  );
}

function UserActions({
  row,
  email,
  status,
  onProfile,
  onEdit,
  onActivity,
  onVerification,
  onSuspend,
  onActivate,
  onDisable,
  onReset,
}: {
  row: UserRow;
  email: string;
  status: AccountStatus;
  onProfile: () => void;
  onEdit: () => void;
  onActivity: () => void;
  onVerification: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDisable: () => void;
  onReset: () => void;
}) {
  return (
    <AdminActionMenu
      items={[
        { label: "View Profile", icon: Eye, onSelect: onProfile },
        { label: "Edit User", icon: Edit, onSelect: onEdit, disabled: !row.profile },
        { label: "View Activity", icon: Activity, onSelect: onActivity },
        { label: "View Verification", icon: ShieldCheck, onSelect: onVerification },
        status === "suspended"
          ? {
              label: "Activate User",
              icon: UserCheck,
              onSelect: onActivate,
              disabled: !row.profile,
              separatorBefore: true,
            }
          : {
              label: "Suspend User",
              icon: UserX,
              onSelect: onSuspend,
              disabled: !row.profile,
              separatorBefore: true,
            },
        {
          label: "Disable Account",
          icon: UserX,
          onSelect: onDisable,
          disabled: !row.profile || status === "disabled",
          destructive: true,
        },
        {
          label: "Reset Password",
          icon: KeyRound,
          onSelect: onReset,
          disabled: !email || email === "-",
          destructive: true,
        },
      ]}
    />
  );
}

function UserDialogContent({
  dialog,
  onOpenChange,
  onSave,
}: {
  dialog: UserDialog;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: Record<string, string | null>) => void;
}) {
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
    <Dialog
      open={!!dialog}
      onOpenChange={(open) => {
        if (!open) setDraft({});
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
              {["full_name", "company_name", "contact_email", "phone_number", "country"].map(
                (field) => (
                  <label key={field} className="text-sm">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {field.replace("_", " ")}
                    </span>
                    <Input
                      value={draft[field] ?? ""}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, [field]: event.target.value }))
                      }
                    />
                  </label>
                ),
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="gold" onClick={() => onSave(row.user_id, draft)}>
                Save
              </Button>
            </div>
          </>
        ) : null}

        {dialog?.type === "activity" && row ? (
          <>
            <DialogHeader>
              <DialogTitle>Activity - {displayName(row.profile)}</DialogTitle>
              <DialogDescription>
                Recent activity summary from marketplace tables.
              </DialogDescription>
            </DialogHeader>
            <ActivitySummary userId={row.user_id} />
          </>
        ) : null}

        {dialog?.type === "verification" && row ? (
          <>
            <DialogHeader>
              <DialogTitle>Verification - {displayName(row.profile)}</DialogTitle>
              <DialogDescription>
                Verification and approval status for this account.
              </DialogDescription>
            </DialogHeader>
            <AdminDetailGrid>
              <AdminDetailItem label="Role" value={<RoleBadges row={row} />} />
              <AdminDetailItem
                label="Agency Verification"
                value={
                  <AdminStatusBadge
                    status={row.profile?.agency_verification_status || "not required"}
                  />
                }
              />
              <AdminDetailItem
                label="Hotel Approval"
                value={
                  <AdminStatusBadge status={row.profile?.hotel_approval_status || "not required"} />
                }
              />
              <AdminDetailItem
                label="Trust Level"
                value={row.profile?.verification_trust_level || "Not assigned"}
              />
              <AdminDetailItem
                label="Reviewed At"
                value={formatAdminDate(row.profile?.verification_reviewed_at ?? null)}
              />
              <AdminDetailItem
                label="Submitted At"
                value={formatAdminDate(row.profile?.verification_submitted_at ?? null)}
              />
            </AdminDetailGrid>
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
        supabase
          .from("agency_verification_events")
          .select("id,event_type,created_at")
          .eq("agency_id", userId)
          .limit(50),
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

  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading activity...
      </div>
    );

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
        <div key={card.label} className="rounded-md border border-border bg-surface/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {card.label}
          </div>
          <div className="mt-1 font-display text-2xl text-primary">{card.value}</div>
        </div>
      ))}
    </div>
  );
}

function ProfileDetails({ row }: { row: UserRow }) {
  return (
    <AdminDetailGrid>
      <AdminDetailItem label="Full Name" value={displayName(row.profile)} />
      <AdminDetailItem label="Company" value={companyName(row.profile)} />
      <AdminDetailItem label="Email" value={contactEmail(row.profile)} />
      <AdminDetailItem
        label="Phone"
        value={row.profile?.phone_number || row.profile?.phone || "-"}
      />
      <AdminDetailItem label="Role" value={<RoleBadges row={row} />} />
      <AdminDetailItem
        label="Account Status"
        value={<AdminStatusBadge status={accountStatus(row.profile)} />}
      />
      <AdminDetailItem label="Country" value={row.profile?.country || "-"} />
      <AdminDetailItem label="Registration Date" value={formatAdminDate(row.created_at)} />
      <AdminDetailItem label="Last Login" value="Requires Supabase Auth Admin" />
      <AdminDetailItem label="User ID" value={row.user_id} />
    </AdminDetailGrid>
  );
}

function RoleBadges({ row }: { row: UserRow }) {
  const roles = row.roles.length ? row.roles : ["visitor"];
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <AdminRoleBadge key={role} role={role} />
      ))}
    </div>
  );
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
  if (row.roles.includes("organizer"))
    return row.profile?.agency_verification_status?.replace("_", " ") || "unverified";
  if (row.roles.includes("hotel")) return row.profile?.hotel_approval_status || "unverified";
  return "not required";
}

function accountStatus(profile?: ProfileWithStatus): AccountStatus {
  return profile?.account_status ?? "active";
}

function displayName(profile?: ProfileWithStatus) {
  return (
    profile?.full_name ||
    profile?.legal_company_name ||
    profile?.trade_name ||
    profile?.company_name ||
    profile?.org_name ||
    "Unnamed user"
  );
}

function companyName(profile?: ProfileWithStatus) {
  return (
    profile?.legal_company_name ||
    profile?.trade_name ||
    profile?.company_name ||
    profile?.org_name ||
    "-"
  );
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
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}
