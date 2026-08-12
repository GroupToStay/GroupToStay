import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/_authenticated/dashboard.hotel.index";

export const metadata: Metadata = { title: "Hotels" };

export default function Page() {
  return <RoutePage />;
}
