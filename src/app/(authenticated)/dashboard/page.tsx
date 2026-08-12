import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/_authenticated/dashboard.index";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <RoutePage />;
}
