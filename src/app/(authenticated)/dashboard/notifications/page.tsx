import type { Metadata } from "next";
import { NotificationsPage as RoutePage } from "@/routes/_authenticated/dashboard.notifications";

export const metadata: Metadata = { title: "Notifications" };

export default function Page() {
  return <RoutePage />;
}
