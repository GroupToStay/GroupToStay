import type { Metadata } from "next";
import { Page as Subscriptions } from "@/routes/_authenticated/admin.subscriptions";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export const metadata: Metadata = { title: "Subscriptions | GroupToStay" };

export default async function SubscriptionsPage() {
  await requireAdminPermission("manage_subscriptions");
  return <Subscriptions />;
}
