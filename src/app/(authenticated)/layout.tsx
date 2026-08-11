"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { RouterOutletProvider } from "@/lib/router-compat";
import { Route as AuthLayoutRoute } from "@/routes/_authenticated/route";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !user) router.replace(`/auth?redirect=${encodeURIComponent(pathname)}`);
  }, [loading, pathname, router, user]);
  if (loading || !user)
    return (
      <main className="grid min-h-screen place-items-center text-muted-foreground">Loading…</main>
    );
  const Shell = AuthLayoutRoute.options.component;
  if (!Shell) return children;
  return (
    <RouterOutletProvider outlet={children}>
      <Shell />
    </RouterOutletProvider>
  );
}
