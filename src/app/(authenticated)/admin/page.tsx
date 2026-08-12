import type { Metadata } from "next";
import { AdminHome } from "@/routes/_authenticated/admin.index";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export const metadata: Metadata = { title: "Administration | GroupToStay" };

export default async function AdminPage() {
  await requireAdminPermission("view_analytics");
  return <AdminHome />;
}
