import type { ReactNode } from "react";
import { requireMarketplaceParticipant } from "@/lib/auth/server-authorization";

export default async function NegotiationsLayout({ children }: { children: ReactNode }) {
  await requireMarketplaceParticipant();
  return children;
}
