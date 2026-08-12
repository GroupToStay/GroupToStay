import type { ReactNode } from "react";
import { requireAuthenticatedUser } from "@/lib/auth/server-authorization";
import { RouterOutletProvider } from "@/lib/router-compat";
import { AuthLayout } from "@/routes/_authenticated/route";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedUser();
  return (
    <RouterOutletProvider outlet={children}>
      <AuthLayout />
    </RouterOutletProvider>
  );
}
