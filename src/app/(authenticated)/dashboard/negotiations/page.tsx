import type { Metadata } from "next";
import { NegotiationsPage as RoutePage } from "@/routes/_authenticated/dashboard.negotiations";

export const metadata: Metadata = { title: "Negotiations" };

export default function Page() {
  return <RoutePage />;
}
