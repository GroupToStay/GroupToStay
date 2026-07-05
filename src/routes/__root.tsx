import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import i18n from "@/lib/i18n";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { ApplicationLocaleProvider } from "@/lib/application-locale";
import {
  applyNoTranslateAttributes,
  installExternalDomMutationRecovery,
  isExternalDomMutationError,
} from "@/lib/translation-hardening";

installExternalDomMutationRecovery();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const isTranslatedDomMutation = isExternalDomMutationError(error);
  if (!isTranslatedDomMutation) {
    console.error(error);
  }

  useEffect(() => {
    if (isTranslatedDomMutation) {
      applyNoTranslateAttributes(i18n.language);
      const resetTimer = window.setTimeout(() => {
        router.invalidate();
        reset();
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error, isTranslatedDomMutation, reset, router]);

  if (isTranslatedDomMutation) {
    return (
      <div className="notranslate sr-only" translate="no" role="status" aria-live="polite">
        Recovering interface
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google", content: "notranslate" },
      { name: "googlebot", content: "notranslate" },
      { title: "GroupToStay — Group accommodation marketplace" },
      {
        name: "description",
        content:
          "Submit one Group Request, receive competing hotel quotations. The B2B platform for group hotel sourcing — Umrah, Hajj, tourism, corporate, sports and events.",
      },
      { name: "author", content: "GroupToStay" },
      { property: "og:site_name", content: "GroupToStay" },
      { property: "og:title", content: "GroupToStay — Group accommodation marketplace" },
      {
        property: "og:description",
        content:
          "Submit one Group Request, receive competing hotel quotations. The B2B platform for group hotel sourcing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "GroupToStay — Group accommodation marketplace" },
      {
        name: "twitter:description",
        content:
          "Submit one Group Request, receive competing hotel quotations. The B2B platform for group hotel sourcing.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&family=Tajawal:wght@400;500;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "GroupToStay",
              url: "https://groupstay-connect.lovable.app",
              description:
                "B2B marketplace connecting group organizers with approved hotels for competitive group quotations.",
            },
            {
              "@type": "WebSite",
              name: "GroupToStay",
              url: "https://groupstay-connect.lovable.app",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body translate="no" className="notranslate" suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ApplicationLocaleProvider>
          <AuthProvider>
            <div id="gts-app-root" className="notranslate contents" translate="no">
              <Outlet />
              <Toaster richColors position="top-center" />
            </div>
          </AuthProvider>
        </ApplicationLocaleProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
