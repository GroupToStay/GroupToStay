import type { Metadata } from "next";
import { RolesAndPermissions } from "@/routes/_authenticated/admin.roles";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export const metadata: Metadata = { title: "Roles and permissions | GroupToStay" };

export default async function AdminRolesPage() {
  await requireAdminPermission("manage_roles");
  return <RolesAndPermissions />;
}
