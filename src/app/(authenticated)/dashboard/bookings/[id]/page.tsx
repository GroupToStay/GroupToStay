import type { Metadata } from "next";
import { BookingDetailPage as RoutePage } from "@/routes/_authenticated/dashboard.bookings.$id";

export const metadata: Metadata = { title: "Booking details" };

export default function Page() {
  return <RoutePage />;
}
