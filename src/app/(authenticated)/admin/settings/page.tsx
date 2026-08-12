import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export default async function AdminSettingsRedirect() {
  await requireAdminPermission("manage_settings");
  redirect("/settings?tab=profile");
}
