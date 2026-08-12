import type { Metadata } from "next";
import { Page as GroupRequests } from "@/routes/_authenticated/admin.group-requests";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export const metadata: Metadata = { title: "Group requests | GroupToStay" };

export default async function GroupRequestsPage() {
  await requireAdminPermission("manage_rfqs");
  return <GroupRequests />;
}
