import type { Metadata } from "next";
import { ApprovalCenter } from "@/routes/_authenticated/admin.approvals";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export const metadata: Metadata = { title: "Approvals | GroupToStay" };

export default async function AdminApprovalsPage() {
  await requireAdminPermission("manage_approvals");
  return <ApprovalCenter />;
}
