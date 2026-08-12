"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import baseI18n from "@/lib/i18n";
import type { AppLanguage } from "@/lib/locale";
import { AuthProvider } from "@/hooks/use-auth";
import { ApplicationLocaleProvider } from "@/lib/application-locale";
import { Toaster } from "@/components/ui/sonner";

export function Providers({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage: AppLanguage;
}) {
  const [i18n] = useState(() => baseI18n.cloneInstance({ initAsync: false, lng: initialLanguage }));
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ApplicationLocaleProvider>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </ApplicationLocaleProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
