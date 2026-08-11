"use client";

import { Suspense, type ComponentType } from "react";

type LegacyRoute = { options: { component?: ComponentType } };

export function LegacyRoutePage({ route }: { route: LegacyRoute }) {
  const Page = route.options.component;
  if (!Page) return null;
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-muted-foreground">Loading…</main>
      }
    >
      <Page />
    </Suspense>
  );
}
