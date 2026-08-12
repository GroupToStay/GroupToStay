import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/_authenticated/dashboard.rfqs.new";

export const metadata: Metadata = { title: "Create request" };

export default function Page() {
  return <RoutePage />;
}
