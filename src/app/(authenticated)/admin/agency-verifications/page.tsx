import type { Metadata } from "next";
import { Page as AgencyVerifications } from "@/routes/_authenticated/admin.agency-verifications";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export const metadata: Metadata = { title: "Agency verifications | GroupToStay" };

export default async function AgencyVerificationsPage() {
  await requireAdminPermission("manage_agencies");
  return <AgencyVerifications />;
}
