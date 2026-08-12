import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/_authenticated/dashboard.invitations";

export const metadata: Metadata = { title: "Invitations" };

export default function Page() {
  return <RoutePage />;
}
