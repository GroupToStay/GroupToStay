import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAuthenticatedUser } from "@/lib/auth/server-authorization";
import { RouterOutletProvider } from "@/lib/router-compat";
import { AuthLayout } from "@/routes/_authenticated/route";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedUser();
  return (
    <RouterOutletProvider outlet={children}>
      <AuthLayout />
    </RouterOutletProvider>
  );
}
