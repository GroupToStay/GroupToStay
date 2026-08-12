import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/hotels.index";

export const metadata: Metadata = {
  title: "Hotels",
  alternates: { canonical: "/hotels" },
  openGraph: { url: "https://group-to-stay.vercel.app/hotels" },
};

export default function Page() {
  return <RoutePage />;
}
