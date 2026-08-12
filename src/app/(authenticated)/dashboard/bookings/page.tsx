import type { Metadata } from "next";
import { BookingsPage as RoutePage } from "@/routes/_authenticated/dashboard.bookings.index";

export const metadata: Metadata = { title: "Bookings" };

export default function Page() {
  return <RoutePage />;
}
