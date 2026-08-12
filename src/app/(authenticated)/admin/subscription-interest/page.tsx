import type { Metadata } from "next";
import { Page as SubscriptionInterest } from "@/routes/_authenticated/admin.subscription-interest";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export const metadata: Metadata = { title: "Subscription interest | GroupToStay" };

export default async function SubscriptionInterestPage() {
  await requireAdminPermission("manage_subscriptions");
  return <SubscriptionInterest />;
}
