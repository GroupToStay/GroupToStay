"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  AdminManagementPage,
  AdminRoleBadge,
  AdminStatusBadge,
} from "@/components/admin/management-ui";
import { AccountAvatar } from "@/components/account-avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { requireAdminPermission } from "@/lib/admin-authorization";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  beforeLoad: () => requireAdminPermission("manage_roles"),
  head: () => ({ meta: [{ title: i18n.t("admin.roles.metaTitle") }] }),
  component: RolesAndPermissions,
});

type EnterpriseRole = Database["public"]["Tables"]["enterprise_roles"]["Row"];
type Permission = Database["public"]["Tables"]["permissions"]["Row"];
type RolePermission = Database["public"]["Tables"]["role_permissions"]["Row"];
type Assignment = Database["public"]["Tables"]["user_enterprise_roles"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type RoleCatalog = {
  assignments: Assignment[];
  permissions: Permission[];
  profiles: Profile[];
  rolePermissions: RolePermission[];
  roles: EnterpriseRole[];
};

export function RolesAndPermissions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { access } = useAdminAccess();
  const [selectedSlug, setSelectedSlug] = useState("assistant_admin");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-role-catalog"],
    queryFn: loadRoleCatalog,
  });

  const selectedRole = data?.roles.find((role) => role.slug === selectedSlug);
  const savedPermissions = useMemo(
    () =>
      data?.rolePermissions
        .filter((permission) => permission.role_id === selectedRole?.id)
        .map((permission) => permission.permission_key)
        .sort() ?? [],
    [data?.rolePermissions, selectedRole?.id],
  );

  useEffect(() => setDraft(savedPermissions), [savedPermissions]);

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedRole) return;
      const { error: mutationError } = await supabase.rpc("admin_set_role_permissions", {
        _role_slug: selectedRole.slug,
        _permission_keys: draft,
      });
      if (mutationError) throw mutationError;
    },
    onSuccess: () => {
      toast.success(t("admin.roles.toasts.permissionsSaved"));
      queryClient.invalidateQueries({ queryKey: ["admin-role-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["my-admin-access"] });
    },
    onError: (mutationError: unknown) =>
      toast.error(
        mutationError instanceof Error ? mutationError.message : t("admin.roles.errors.saveFailed"),
      ),
  });

  const groupedPermissions = useMemo(() => {
    const filter = search.trim().toLowerCase();
    const groups = new Map<string, Permission[]>();
    (data?.permissions ?? [])
      .filter((permission) => {
        if (!filter) return true;
        return [permission.key, permission.name, permission.description, permission.category]
          .join(" ")
          .toLowerCase()
          .includes(filter);
      })
      .forEach((permission) => {
        groups.set(permission.category, [...(groups.get(permission.category) ?? []), permission]);
      });
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [data?.permissions, search]);

  const assignedUsers = useMemo(() => {
    if (!selectedRole || !data) return [];
    const profileMap = new Map(data.profiles.map((profile) => [profile.id, profile]));
    return data.assignments
      .filter((assignment) => assignment.role_id === selectedRole.id)
      .map((assignment) => ({
        assignment,
        profile: profileMap.get(assignment.user_id),
      }));
  }, [data, selectedRole]);

  const canEdit =
    !!selectedRole && !selectedRole.is_protected && access.accessLevel > selectedRole.access_level;
  const isDirty = [...draft].sort().join("|") !== savedPermissions.join("|");

  return (
    <AdminManagementPage
      title={t("admin.roles.title")}
      description={t("admin.roles.description")}
      icon={ShieldCheck}
    >
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-[560px] rounded-lg" />
        </div>
      ) : error || !data ? (
        <Card>
          <CardContent className="p-6 text-sm text-error">
            {t("admin.roles.errors.loadFailed")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="h-fit border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("admin.roles.roleList")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.roles.map((role) => {
                const count = data.assignments.filter(
                  (assignment) => assignment.role_id === role.id,
                ).length;
                const active = role.slug === selectedSlug;
                return (
                  <button
                    key={role.id}
                    type="button"
                    className={`w-full rounded-md border p-3 text-left transition-colors rtl:text-right ${
                      active
                        ? "border-primary/30 bg-primary/5"
                        : "border-transparent hover:border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedSlug(role.slug)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <AdminRoleBadge role={role.slug} />
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {t(`admin.roles.defaults.${role.slug}.description`)}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4">
            <Card className="border-border shadow-sm">
              <CardHeader className="gap-4 border-b border-border">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">
                        {selectedRole ? t(`admin.roles.defaults.${selectedRole.slug}.name`) : ""}
                      </CardTitle>
                      {selectedRole?.is_protected ? <AdminStatusBadge status="protected" /> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedRole
                        ? t(`admin.roles.defaults.${selectedRole.slug}.description`)
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {t("admin.roles.accessLevel", {
                        level: selectedRole?.access_level ?? 0,
                      })}
                    </Badge>
                    <Button
                      variant="gold"
                      disabled={!canEdit || !isDirty || save.isPending}
                      onClick={() => save.mutate()}
                    >
                      {save.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {t("common.save")}
                    </Button>
                  </div>
                </div>
                {!canEdit ? (
                  <div className="flex items-center gap-2 rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
                    <LockKeyhole className="h-4 w-4 shrink-0" />
                    {selectedRole?.is_protected
                      ? t("admin.roles.protectedRole")
                      : t("admin.roles.higherRoleRequired")}
                  </div>
                ) : null}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("admin.roles.searchPermissions")}
                    className="pl-9 rtl:pl-3 rtl:pr-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <Accordion
                  type="multiple"
                  defaultValue={groupedPermissions.map(([category]) => category)}
                  className="space-y-2"
                >
                  {groupedPermissions.map(([category, permissions]) => (
                    <AccordionItem
                      key={category}
                      value={category}
                      className="rounded-md border border-border px-3"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <span className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-primary" />
                          {t(`admin.roles.categories.${category}`)}
                          <Badge variant="secondary">{permissions.length}</Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-2 xl:grid-cols-2">
                          {permissions.map((permission) => {
                            const checked = draft.includes(permission.key);
                            return (
                              <label
                                key={permission.key}
                                className="flex min-h-20 items-start gap-3 rounded-md border border-border p-3"
                              >
                                <Checkbox
                                  className="mt-0.5"
                                  checked={checked}
                                  disabled={!canEdit}
                                  onCheckedChange={(next) =>
                                    setDraft((current) =>
                                      next
                                        ? [...new Set([...current, permission.key])]
                                        : current.filter((key) => key !== permission.key),
                                    )
                                  }
                                />
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium">
                                    {t(`admin.roles.permissions.${permission.key}.name`)}
                                  </span>
                                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                    {t(`admin.roles.permissions.${permission.key}.description`)}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  {t("admin.roles.assignedUsers")}
                  <Badge variant="secondary">{assignedUsers.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignedUsers.length ? (
                  <ul className="divide-y divide-border">
                    {assignedUsers.map(({ assignment, profile }) => {
                      const name =
                        profile?.full_name ||
                        profile?.company_name ||
                        profile?.org_name ||
                        t("admin.users.fallbacks.unnamedUser");
                      return (
                        <li
                          key={assignment.user_id}
                          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <AccountAvatar name={name} className="h-9 w-9" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {profile?.contact_email || assignment.user_id}
                            </div>
                          </div>
                          <AdminRoleBadge role={selectedRole?.slug} />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("admin.roles.noAssignedUsers")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AdminManagementPage>
  );
}

async function loadRoleCatalog(): Promise<RoleCatalog> {
  const [roles, permissions, rolePermissions, assignments, profiles] = await Promise.all([
    supabase.from("enterprise_roles").select("*").order("access_level", { ascending: false }),
    supabase.from("permissions").select("*").order("category").order("key"),
    supabase.from("role_permissions").select("*"),
    supabase.from("user_enterprise_roles").select("*"),
    supabase.from("profiles").select("*"),
  ]);
  const firstError =
    roles.error ||
    permissions.error ||
    rolePermissions.error ||
    assignments.error ||
    profiles.error;
  if (firstError) throw firstError;
  return {
    roles: roles.data ?? [],
    permissions: permissions.data ?? [],
    rolePermissions: rolePermissions.data ?? [],
    assignments: assignments.data ?? [],
    profiles: profiles.data ?? [],
  };
}
