import { redirect } from "next/navigation";

export default function SubscriptionCheckoutRedirect() {
  redirect("/subscription/coming-soon");
}
