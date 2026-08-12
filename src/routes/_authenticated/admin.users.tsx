"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Activity,
  Edit,
  Eye,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  ShieldPlus,
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
import { AccountAvatar } from "@/components/account-avatar";
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
import type { Database } from "@/integrations/supabase/types";
import { useApplicationLocale } from "@/lib/application-locale";
import i18n from "@/lib/i18n";
import { useAccountIdentity } from "@/hooks/use-account-identity";
import { requireAdminPermission } from "@/lib/admin-authorization";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: () => requireAdminPermission("manage_users"),
  head: () => ({ meta: [{ title: i18n.t("admin.users.metaTitle") }] }),
  component: Page,
});

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfilePatch = Database["public"]["Tables"]["profiles"]["Update"];
type AppRole = Database["public"]["Tables"]["user_roles"]["Row"]["role"];
type EnterpriseRole = Database["public"]["Tables"]["enterprise_roles"]["Row"];
type Permission = Database["public"]["Tables"]["permissions"]["Row"];
type RolePermission = Database["public"]["Tables"]["role_permissions"]["Row"];
type PermissionOverride = Database["public"]["Tables"]["user_permission_overrides"]["Row"];
type RoleFilter = "all" | "visitor" | AppRole;
type AccountStatus = "active" | "suspended" | "disabled";
type VerificationFilter = "all" | "verified" | "pending" | "rejected" | "draft" | "unverified";
type UserDialog =
  | { type: "profile"; row: UserRow }
  | { type: "edit"; row: UserRow }
  | { type: "activity"; row: UserRow }
  | { type: "verification"; row: UserRow }
  | null;
type AccessDialog = { type: "role"; row: UserRow } | { type: "permissions"; row: UserRow } | null;

type ProfileWithStatus = Profile & {
  account_status?: AccountStatus | null;
  avatar_url?: string | null;
};

type UserRow = {
  user_id: string;
  authEmail?: string;
  lastSignInAt?: string | null;
  roles: AppRole[];
  roleLabel: string;
  enterpriseRole?: EnterpriseRole;
  effectivePermissions: string[];
  profile?: ProfileWithStatus;
  created_at: string;
};

const roleFilterKeys: { value: RoleFilter; labelKey: string }[] = [
  { value: "all", labelKey: "admin.users.filters.allRoles" },
  { value: "visitor", labelKey: "admin.users.filters.visitors" },
  { value: "organizer", labelKey: "admin.users.filters.agencies" },
  { value: "hotel", labelKey: "admin.users.filters.hotels" },
  { value: "admin", labelKey: "admin.users.filters.administrators" },
];

const verificationFilterKeys: { value: VerificationFilter; labelKey: string }[] = [
  { value: "all", labelKey: "admin.users.filters.allVerification" },
  { value: "verified", labelKey: "admin.users.filters.verifiedApproved" },
  { value: "pending", labelKey: "status.pending" },
  { value: "rejected", labelKey: "status.rejected" },
  { value: "draft", labelKey: "status.draft" },
  { value: "unverified", labelKey: "status.unverified" },
];

const accountFilterKeys: { value: "all" | AccountStatus; labelKey: string }[] = [
  { value: "all", labelKey: "admin.users.filters.allAccountStatus" },
  { value: "active", labelKey: "status.active" },
  { value: "suspended", labelKey: "status.suspended" },
  { value: "disabled", labelKey: "status.disabled" },
];

export function Page() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { avatarUrl: currentAvatarUrl, user: currentUser } = useAccountIdentity();
  const { hasPermission } = useAdminAccess();
  const { compare, language } = useApplicationLocale();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
  const [accountFilter, setAccountFilter] = useState<"all" | AccountStatus>("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<UserDialog>(null);
  const [accessDialog, setAccessDialog] = useState<AccessDialog>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-user-management"],
    queryFn: async () => {
      const [
        rolesResult,
        profilesResult,
        enterpriseRolesResult,
        assignmentsResult,
        permissionsResult,
        rolePermissionsResult,
        overridesResult,
        authMetadataResult,
      ] = await Promise.all([
        supabase.from("user_roles").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("enterprise_roles").select("*").order("access_level", { ascending: false }),
        supabase.from("user_enterprise_roles").select("*"),
        supabase.from("permissions").select("*").order("category").order("key"),
        supabase.from("role_permissions").select("*"),
        supabase.from("user_permission_overrides").select("*"),
        supabase.rpc("admin_get_user_auth_metadata"),
      ]);

      const firstError =
        rolesResult.error ||
        profilesResult.error ||
        enterpriseRolesResult.error ||
        assignmentsResult.error ||
        permissionsResult.error ||
        rolePermissionsResult.error ||
        overridesResult.error ||
        authMetadataResult.error;
      if (firstError) throw firstError;

      const rolesByUser = new Map<string, AppRole[]>();
      const roleCreatedByUser = new Map<string, string>();
      (rolesResult.data ?? []).forEach((role) => {
        rolesByUser.set(role.user_id, [...(rolesByUser.get(role.user_id) ?? []), role.role]);
        if (!roleCreatedByUser.has(role.user_id))
          roleCreatedByUser.set(role.user_id, role.created_at);
      });

      const profiles = (profilesResult.data ?? []) as ProfileWithStatus[];
      const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
      const enterpriseRoles = enterpriseRolesResult.data ?? [];
      const enterpriseRoleById = new Map(enterpriseRoles.map((role) => [role.id, role]));
      const assignmentByUser = new Map(
        (assignmentsResult.data ?? []).map((assignment) => [
          assignment.user_id,
          enterpriseRoleById.get(assignment.role_id),
        ]),
      );
      const rolePermissions = rolePermissionsResult.data ?? [];
      const overridesByUser = new Map<string, PermissionOverride[]>();
      (overridesResult.data ?? []).forEach((override) =>
        overridesByUser.set(override.user_id, [
          ...(overridesByUser.get(override.user_id) ?? []),
          override,
        ]),
      );
      const authMetadataByUser = new Map(
        (authMetadataResult.data ?? []).map((metadata) => [metadata.user_id, metadata]),
      );
      const userIds = new Set<string>([
        ...profiles.map((profile) => profile.id),
        ...(rolesResult.data ?? []).map((role) => role.user_id),
        ...(authMetadataResult.data ?? []).map((metadata) => metadata.user_id),
      ]);

      return [...userIds]
        .map((user_id) => {
          const roles = rolesByUser.get(user_id) ?? [];
          const profile = profileById.get(user_id);
          const authMetadata = authMetadataByUser.get(user_id);
          const enterpriseRole = assignmentByUser.get(user_id);
          const inheritedPermissions =
            enterpriseRole?.slug === "super_admin"
              ? (permissionsResult.data ?? []).map((permission) => permission.key)
              : rolePermissions
                  .filter((permission) => permission.role_id === enterpriseRole?.id)
                  .map((permission) => permission.permission_key);
          const effectivePermissions = new Set(inheritedPermissions);
          (overridesByUser.get(user_id) ?? []).forEach((override) => {
            if (override.granted) effectivePermissions.add(override.permission_key);
            else effectivePermissions.delete(override.permission_key);
          });
          return {
            user_id,
            authEmail: authMetadata?.email,
            lastSignInAt: authMetadata?.last_sign_in_at,
            roles,
            roleLabel: roles.length ? roles.join(", ") : "visitor",
            enterpriseRole,
            effectivePermissions: [...effectivePermissions].sort(),
            profile,
            created_at:
              authMetadata?.created_at ??
              profile?.created_at ??
              roleCreatedByUser.get(user_id) ??
              new Date(0).toISOString(),
          };
        })
        .sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ) satisfies UserRow[];
    },
  });

  const { data: accessCatalog } = useQuery({
    queryKey: ["admin-access-catalog"],
    queryFn: async () => {
      const [rolesResult, permissionsResult] = await Promise.all([
        supabase.from("enterprise_roles").select("*").order("access_level", { ascending: false }),
        supabase.from("permissions").select("*").order("category").order("key"),
      ]);
      if (rolesResult.error) throw rolesResult.error;
      if (permissionsResult.error) throw permissionsResult.error;
      return {
        roles: rolesResult.data ?? [],
        permissions: permissionsResult.data ?? [],
      };
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
      toast.success(t("admin.users.toasts.accountStatusUpdated"));
      qc.invalidateQueries({ queryKey: ["admin-user-management"] });
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, t("admin.users.errors.accountStatusUpdateFailed"))),
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
      toast.success(t("admin.users.toasts.profileUpdated"));
      setDialog(null);
      qc.invalidateQueries({ queryKey: ["admin-user-management"] });
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, t("admin.users.errors.profileUpdateFailed"))),
  });

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success(t("admin.users.toasts.passwordResetSent")),
    onError: (err: unknown) =>
      toast.error(errorMessage(err, t("admin.users.errors.passwordResetFailed"))),
  });

  const countries = useMemo(() => {
    return [...new Set(rows.map((row) => row.profile?.country).filter(Boolean) as string[])].sort(
      compare,
    );
  }, [compare, rows]);

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (roleFilter !== "all") {
        if (roleFilter === "visitor" && (row.roles.length > 0 || row.enterpriseRole)) return false;
        if (
          roleFilter !== "visitor" &&
          !row.roles.includes(roleFilter) &&
          !(roleFilter === "admin" && row.enterpriseRole)
        )
          return false;
      }
      if (countryFilter !== "all" && row.profile?.country !== countryFilter) return false;
      if (accountFilter !== "all" && accountStatus(row.profile) !== accountFilter) return false;
      if (verificationFilter !== "all" && verificationStatusKey(row) !== verificationFilter)
        return false;
      if (!text) return true;
      return [
        displayName(row.profile),
        companyName(row.profile),
        contactEmail(row),
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
      admins: rows.filter((row) => row.roles.includes("admin") || row.enterpriseRole).length,
      active: rows.filter((row) => accountStatus(row.profile) === "active").length,
    };
  }, [rows]);

  const metrics: AdminMetric[] = [
    {
      label: t("admin.users.metrics.allUsers.label"),
      value: formatCompactNumber(roleCounts.all, language),
      description: t("admin.users.metrics.allUsers.description"),
      icon: Users,
      tone: "info",
    },
    {
      label: t("admin.users.metrics.agencies.label"),
      value: formatCompactNumber(roleCounts.agencies, language),
      description: t("admin.users.metrics.agencies.description"),
      icon: UserCheck,
      tone: "success",
    },
    {
      label: t("admin.users.metrics.hotels.label"),
      value: formatCompactNumber(roleCounts.hotels, language),
      description: t("admin.users.metrics.hotels.description"),
      icon: UserRound,
      tone: "gold",
    },
    {
      label: t("admin.users.metrics.admins.label"),
      value: formatCompactNumber(roleCounts.admins, language),
      description: t("admin.users.metrics.admins.description"),
      icon: ShieldCheck,
      tone: "purple",
    },
    {
      label: t("admin.users.metrics.active.label"),
      value: formatCompactNumber(roleCounts.active, language),
      description: t("admin.users.metrics.active.description"),
      icon: UserCheck,
      tone: "success",
    },
  ];

  return (
    <AdminManagementPage
      title={t("admin.users.title")}
      description={t("admin.users.description")}
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
            placeholder={t("admin.users.searchPlaceholder")}
          />
        </div>
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
          <SelectTrigger className="w-full lg:w-[155px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleFilterKeys.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {t(item.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-full lg:w-[170px]">
            <SelectValue placeholder={t("common.country")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.users.filters.allCountries")}</SelectItem>
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
            {verificationFilterKeys.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {t(item.labelKey)}
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
            {accountFilterKeys.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {t(item.labelKey)}
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
          {t("admin.common.resetFilters")}
        </Button>
      </AdminToolbar>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("admin.users.loading")}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-error">
            {t("admin.users.errors.loadFailed")}
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title={t("admin.users.empty.title")}
          description={t("admin.users.empty.description")}
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
                  <TableHead>{t("admin.users.table.user")}</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    {t("admin.users.table.company")}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("admin.users.table.phone")}
                  </TableHead>
                  <TableHead>{t("admin.users.table.role")}</TableHead>
                  <TableHead className="hidden 2xl:table-cell">
                    {t("admin.users.table.permissions")}
                  </TableHead>
                  <TableHead>{t("admin.users.table.verification")}</TableHead>
                  <TableHead>{t("admin.users.table.account")}</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    {t("admin.users.table.country")}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("admin.users.table.joined")}
                  </TableHead>
                  <TableHead className="w-12 text-right">
                    {t("admin.users.table.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => {
                  const email = contactEmail(row);
                  const status = accountStatus(row.profile);
                  return (
                    <TableRow
                      key={row.user_id}
                      className="cursor-pointer"
                      onClick={() => setDialog({ type: "profile", row })}
                    >
                      <TableCell className="min-w-[230px]">
                        <div className="flex items-center gap-3">
                          <AccountAvatar
                            name={displayName(row.profile)}
                            imageUrl={
                              row.user_id === currentUser?.id
                                ? currentAvatarUrl
                                : row.profile?.avatar_url
                            }
                            className="h-9 w-9"
                          />
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
                      <TableCell className="hidden 2xl:table-cell">
                        {t("admin.users.details.permissionCount", {
                          count: row.effectivePermissions.length,
                        })}
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
                            canManageRoles={hasPermission("manage_roles")}
                            onRole={() => setAccessDialog({ type: "role", row })}
                            onPermissions={() => setAccessDialog({ type: "permissions", row })}
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
              const email = contactEmail(row);
              const status = accountStatus(row.profile);
              return (
                <div key={row.user_id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-3 text-left"
                      onClick={() => setDialog({ type: "profile", row })}
                    >
                      <AccountAvatar
                        name={displayName(row.profile)}
                        imageUrl={
                          row.user_id === currentUser?.id
                            ? currentAvatarUrl
                            : row.profile?.avatar_url
                        }
                        className="h-9 w-9"
                      />
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
                      canManageRoles={hasPermission("manage_roles")}
                      onRole={() => setAccessDialog({ type: "role", row })}
                      onPermissions={() => setAccessDialog({ type: "permissions", row })}
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
                    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t("admin.users.details.permissionCount", {
                        count: row.effectivePermissions.length,
                      })}
                    </span>
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
      <EnterpriseAccessDialog
        dialog={accessDialog}
        roles={accessCatalog?.roles ?? []}
        permissions={accessCatalog?.permissions ?? []}
        onClose={() => setAccessDialog(null)}
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
  canManageRoles,
  onRole,
  onPermissions,
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
  canManageRoles: boolean;
  onRole: () => void;
  onPermissions: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDisable: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <AdminActionMenu
      items={[
        { label: t("admin.users.actions.viewProfile"), icon: Eye, onSelect: onProfile },
        {
          label: t("admin.users.actions.editUser"),
          icon: Edit,
          onSelect: onEdit,
          disabled: !row.profile,
        },
        { label: t("admin.users.actions.viewActivity"), icon: Activity, onSelect: onActivity },
        {
          label: t("admin.users.actions.viewVerification"),
          icon: ShieldCheck,
          onSelect: onVerification,
        },
        {
          label: t("admin.users.actions.changeRole"),
          icon: ShieldPlus,
          onSelect: onRole,
          disabled: !canManageRoles,
          separatorBefore: true,
        },
        {
          label: t("admin.users.actions.assignPermissions"),
          icon: KeyRound,
          onSelect: onPermissions,
          disabled: !canManageRoles,
        },
        status === "suspended"
          ? {
              label: t("admin.users.actions.activateUser"),
              icon: UserCheck,
              onSelect: onActivate,
              disabled: !row.profile,
              separatorBefore: true,
            }
          : {
              label: t("admin.users.actions.suspendUser"),
              icon: UserX,
              onSelect: onSuspend,
              disabled: !row.profile,
              separatorBefore: true,
            },
        {
          label: t("admin.users.actions.disableAccount"),
          icon: UserX,
          onSelect: onDisable,
          disabled: !row.profile || status === "disabled",
          destructive: true,
        },
        {
          label: t("admin.users.actions.resetPassword"),
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
  const { t } = useTranslation();
  const row = dialog?.row;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const editFields = [
    { name: "full_name", label: t("admin.users.fields.fullName") },
    { name: "company_name", label: t("admin.users.fields.companyName") },
    { name: "contact_email", label: t("admin.users.fields.contactEmail") },
    { name: "phone_number", label: t("admin.users.fields.phoneNumber") },
    { name: "country", label: t("common.country") },
  ];

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
              <DialogDescription>
                {t("admin.users.dialog.userId", { id: row.user_id })}
              </DialogDescription>
            </DialogHeader>
            <ProfileDetails row={row} />
          </>
        ) : null}

        {dialog?.type === "edit" && row?.profile ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("admin.users.dialog.editTitle")}</DialogTitle>
              <DialogDescription>{t("admin.users.dialog.editDescription")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {editFields.map((field) => (
                <label key={field.name} className="text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {field.label}
                  </span>
                  <Input
                    value={draft[field.name] ?? ""}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, [field.name]: event.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="gold" onClick={() => onSave(row.user_id, draft)}>
                {t("common.save")}
              </Button>
            </div>
          </>
        ) : null}

        {dialog?.type === "activity" && row ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("admin.users.dialog.activityTitle", { name: displayName(row.profile) })}
              </DialogTitle>
              <DialogDescription>{t("admin.users.dialog.activityDescription")}</DialogDescription>
            </DialogHeader>
            <ActivitySummary userId={row.user_id} />
          </>
        ) : null}

        {dialog?.type === "verification" && row ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("admin.users.dialog.verificationTitle", { name: displayName(row.profile) })}
              </DialogTitle>
              <DialogDescription>
                {t("admin.users.dialog.verificationDescription")}
              </DialogDescription>
            </DialogHeader>
            <AdminDetailGrid>
              <AdminDetailItem
                label={t("admin.users.table.role")}
                value={<RoleBadges row={row} />}
              />
              <AdminDetailItem
                label={t("admin.users.details.agencyVerification")}
                value={
                  <AdminStatusBadge
                    status={row.profile?.agency_verification_status || "not_required"}
                  />
                }
              />
              <AdminDetailItem
                label={t("admin.users.details.hotelApproval")}
                value={
                  <AdminStatusBadge status={row.profile?.hotel_approval_status || "not_required"} />
                }
              />
              <AdminDetailItem
                label={t("admin.users.details.trustLevel")}
                value={
                  row.profile?.verification_trust_level || t("admin.users.fallbacks.notAssigned")
                }
              />
              <AdminDetailItem
                label={t("admin.users.details.reviewedAt")}
                value={formatAdminDate(row.profile?.verification_reviewed_at ?? null)}
              />
              <AdminDetailItem
                label={t("admin.users.details.submittedAt")}
                value={formatAdminDate(row.profile?.verification_submitted_at ?? null)}
              />
            </AdminDetailGrid>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EnterpriseAccessDialog({
  dialog,
  roles,
  permissions,
  onClose,
}: {
  dialog: AccessDialog;
  roles: EnterpriseRole[];
  permissions: Permission[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { access } = useAdminAccess();
  const [selectedRole, setSelectedRole] = useState("none");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (!dialog) return;
    setSelectedRole(dialog.row.enterpriseRole?.slug ?? "none");
    setSelectedPermissions(dialog.row.effectivePermissions);
  }, [dialog]);

  const saveRole = useMutation({
    mutationFn: async () => {
      if (!dialog) return;
      const { error } = await supabase.rpc("admin_set_user_role", {
        _target_user_id: dialog.row.user_id,
        _role_slug: selectedRole === "none" ? "" : selectedRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.users.toasts.roleUpdated"));
      queryClient.invalidateQueries({ queryKey: ["admin-user-management"] });
      queryClient.invalidateQueries({ queryKey: ["admin-role-catalog"] });
      onClose();
    },
    onError: (mutationError: unknown) =>
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : t("admin.users.errors.roleUpdateFailed"),
      ),
  });

  const savePermissions = useMutation({
    mutationFn: async () => {
      if (!dialog) return;
      const { error } = await supabase.rpc("admin_set_user_permissions", {
        _target_user_id: dialog.row.user_id,
        _permission_keys: selectedPermissions,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.users.toasts.permissionsUpdated"));
      queryClient.invalidateQueries({ queryKey: ["admin-user-management"] });
      onClose();
    },
    onError: (mutationError: unknown) =>
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : t("admin.users.errors.permissionsUpdateFailed"),
      ),
  });

  const grouped = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    permissions.forEach((permission) =>
      groups.set(permission.category, [...(groups.get(permission.category) ?? []), permission]),
    );
    return [...groups.entries()];
  }, [permissions]);

  const targetProtected = dialog?.row.enterpriseRole?.slug === "super_admin";
  const targetAccessLevel = dialog?.row.enterpriseRole?.access_level ?? 0;
  const canChangeTarget =
    access.role === "super_admin" || (!targetProtected && access.accessLevel > targetAccessLevel);

  return (
    <Dialog open={!!dialog} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {dialog ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {dialog.type === "role"
                  ? t("admin.users.access.roleTitle")
                  : t("admin.users.access.permissionsTitle")}
              </DialogTitle>
              <DialogDescription>
                {t("admin.users.access.description", {
                  name: displayName(dialog.row.profile),
                })}
              </DialogDescription>
            </DialogHeader>

            {dialog.type === "role" ? (
              <div className="space-y-3">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{t("admin.users.access.enterpriseRole")}</span>
                  <Select
                    value={selectedRole}
                    onValueChange={setSelectedRole}
                    disabled={!canChangeTarget}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("admin.users.access.noAdminRole")}</SelectItem>
                      {roles.map((role) => (
                        <SelectItem
                          key={role.id}
                          value={role.slug}
                          disabled={
                            role.access_level >= access.accessLevel && access.role !== "super_admin"
                          }
                        >
                          {t(`admin.roles.defaults.${role.slug}.name`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("admin.users.access.roleHelp")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {targetProtected ? (
                  <div className="rounded-md border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
                    {t("admin.users.access.superAdminProtected")}
                  </div>
                ) : null}
                {grouped.map(([category, categoryPermissions]) => (
                  <section key={category} className="space-y-2">
                    <h3 className="text-sm font-semibold">
                      {t(`admin.roles.categories.${category}`)}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {categoryPermissions.map((permission) => (
                        <label
                          key={permission.key}
                          className="flex min-h-16 items-start gap-3 rounded-md border border-border p-3"
                        >
                          <Checkbox
                            checked={selectedPermissions.includes(permission.key)}
                            disabled={targetProtected}
                            onCheckedChange={(checked) =>
                              setSelectedPermissions((current) =>
                                checked
                                  ? [...new Set([...current, permission.key])]
                                  : current.filter((key) => key !== permission.key),
                              )
                            }
                          />
                          <span className="text-sm">
                            {t(`admin.roles.permissions.${permission.key}.name`)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="gold"
                disabled={
                  !canChangeTarget ||
                  saveRole.isPending ||
                  savePermissions.isPending ||
                  (dialog.type === "permissions" && targetProtected)
                }
                onClick={() =>
                  dialog.type === "role" ? saveRole.mutate() : savePermissions.mutate()
                }
              >
                {saveRole.isPending || savePermissions.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {t("common.save")}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ActivitySummary({ userId }: { userId: string }) {
  const { t } = useTranslation();
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
        <Loader2 className="h-4 w-4 animate-spin" /> {t("admin.users.activity.loading")}
      </div>
    );

  const cards = [
    { label: t("admin.users.activity.rfqsCreated"), value: data?.rfqs.length ?? 0 },
    { label: t("admin.users.activity.hotelsOwned"), value: data?.hotels.length ?? 0 },
    { label: t("admin.users.activity.messagesSent"), value: data?.messages.length ?? 0 },
    { label: t("admin.users.activity.notifications"), value: data?.notifications.length ?? 0 },
    { label: t("admin.users.activity.verificationEvents"), value: data?.events.length ?? 0 },
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
  const { t } = useTranslation();

  return (
    <AdminDetailGrid>
      <AdminDetailItem label={t("admin.users.fields.fullName")} value={displayName(row.profile)} />
      <AdminDetailItem label={t("admin.users.table.company")} value={companyName(row.profile)} />
      <AdminDetailItem label={t("admin.users.fields.email")} value={contactEmail(row)} />
      <AdminDetailItem
        label={t("admin.users.table.phone")}
        value={row.profile?.phone_number || row.profile?.phone || "-"}
      />
      <AdminDetailItem label={t("admin.users.table.role")} value={<RoleBadges row={row} />} />
      <AdminDetailItem
        label={t("admin.users.details.assignedPermissions")}
        value={t("admin.users.details.permissionCount", {
          count: row.effectivePermissions.length,
        })}
      />
      <AdminDetailItem
        label={t("admin.users.details.accountStatus")}
        value={<AdminStatusBadge status={accountStatus(row.profile)} />}
      />
      <AdminDetailItem label={t("common.country")} value={row.profile?.country || "-"} />
      <AdminDetailItem
        label={t("admin.users.details.registrationDate")}
        value={formatAdminDate(row.created_at)}
      />
      <AdminDetailItem
        label={t("admin.users.details.lastLogin")}
        value={row.lastSignInAt ? formatAdminDate(row.lastSignInAt) : "-"}
      />
      <AdminDetailItem label={t("admin.users.details.userId")} value={row.user_id} />
    </AdminDetailGrid>
  );
}

function RoleBadges({ row }: { row: UserRow }) {
  const roles = [
    ...(row.enterpriseRole ? [row.enterpriseRole.slug] : []),
    ...row.roles.filter((role) => role !== "admin" || !row.enterpriseRole),
  ];
  if (!roles.length) roles.push("visitor");
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
  return "not_required";
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
    i18n.t("admin.users.fallbacks.unnamedUser")
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

function contactEmail(row: UserRow) {
  return (
    row.authEmail ||
    row.profile?.contact_email ||
    row.profile?.contact_person_email ||
    row.profile?.billing_email ||
    "-"
  );
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}
