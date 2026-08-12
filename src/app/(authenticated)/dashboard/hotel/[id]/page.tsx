import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/_authenticated/dashboard.hotel.$id";

export const metadata: Metadata = { title: "Manage hotel" };

export default function Page() {
  return <RoutePage />;
}
