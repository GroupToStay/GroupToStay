import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/_authenticated/dashboard.quotations";

export const metadata: Metadata = { title: "Quotations" };

export default function Page() {
  return <RoutePage />;
}
