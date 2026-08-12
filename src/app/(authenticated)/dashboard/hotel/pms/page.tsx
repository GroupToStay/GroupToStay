import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/_authenticated/dashboard.hotel.pms";

export const metadata: Metadata = { title: "PMS integration" };

export default function Page() {
  return <RoutePage />;
}
