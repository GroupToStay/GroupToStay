import type { ReactNode } from "react";
import { requireMarketplaceRole } from "@/lib/auth/server-authorization";

export default async function HotelLayout({ children }: { children: ReactNode }) {
  await requireMarketplaceRole("hotel");
  return children;
}
