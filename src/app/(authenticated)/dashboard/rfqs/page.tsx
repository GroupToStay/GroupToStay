import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/_authenticated/dashboard.rfqs.index";

export const metadata: Metadata = { title: "Requests" };

export default function Page() {
  return <RoutePage />;
}
