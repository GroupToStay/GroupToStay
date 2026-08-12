import type { ReactNode } from "react";
import { requireMarketplaceRole } from "@/lib/auth/server-authorization";

export default async function AgencyRfqLayout({ children }: { children: ReactNode }) {
  await requireMarketplaceRole("organizer");
  return children;
}
