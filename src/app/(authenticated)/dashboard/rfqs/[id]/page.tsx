import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/_authenticated/dashboard.rfqs.$id";

export const metadata: Metadata = { title: "Request details" };

export default function Page() {
  return <RoutePage />;
}
