import type { Metadata } from "next";
import { Page as AdminUsers } from "@/routes/_authenticated/admin.users";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export const metadata: Metadata = { title: "Users | GroupToStay" };

export default async function AdminUsersPage() {
  await requireAdminPermission("manage_users");
  return <AdminUsers />;
}
