import type { Metadata } from "next";
import { DealWorkspaceRoute as RoutePage } from "@/routes/_authenticated/deals.$dealId";

export const metadata: Metadata = { title: "Negotiation workspace" };

export default function Page() {
  return <RoutePage />;
}
