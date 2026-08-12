import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/_authenticated/dashboard.agency-profile";

export const metadata: Metadata = { title: "Agency profile" };

export default function Page() {
  return <RoutePage />;
}
