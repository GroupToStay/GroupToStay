import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/_authenticated/dashboard.rfqs.$id.compare";

export const metadata: Metadata = { title: "Compare offers" };

export default function Page() {
  return <RoutePage />;
}
