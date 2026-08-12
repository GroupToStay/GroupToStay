import type { Metadata } from "next";
import { HotelListAccessDenied as RoutePage } from "@/routes/hotel-list";

export const metadata: Metadata = {
  title: "Hotel directory",
  alternates: { canonical: "/hotel-list" },
  openGraph: { url: "https://group-to-stay.vercel.app/hotel-list" },
};

export default function Page() {
  return <RoutePage />;
}
