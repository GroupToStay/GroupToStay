import type { ReactNode } from "react";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPermission();
  return children;
}
