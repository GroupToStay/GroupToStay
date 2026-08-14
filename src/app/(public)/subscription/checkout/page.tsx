import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Subscription checkout",
  robots: { index: false, follow: false, noarchive: true },
};

export default function SubscriptionCheckoutRedirect() {
  redirect("/subscription/coming-soon");
}
