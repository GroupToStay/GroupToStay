// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const securityHeaders = {
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

type LovableConfig = Parameters<typeof defineConfig>[0];
type RollupWarning = { code?: string; id?: string; message?: string };
type RollupWarn = (warning: RollupWarning | string | (() => RollupWarning | string)) => void;

function manualChunks(id: string) {
  if (!id.includes("node_modules")) return undefined;

  const normalizedId = id.replace(/\\/g, "/");

  if (normalizedId.includes("/@supabase/")) {
    return "vendor-supabase";
  }

  if (normalizedId.includes("/date-fns/") || normalizedId.includes("/date-fns-tz/")) {
    return "vendor-date";
  }

  if (normalizedId.includes("/react-day-picker/")) {
    return "vendor-calendar";
  }

  if (normalizedId.includes("/i18next/") || normalizedId.includes("/react-i18next/")) {
    return "vendor-i18n";
  }

  if (normalizedId.includes("/zod/")) {
    return "vendor-validation";
  }

  return undefined;
}

const config = {
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
        onwarn(warning: RollupWarning, warn: RollupWarn) {
          if (warning.code === "MODULE_LEVEL_DIRECTIVE" && warning.id?.includes("node_modules")) {
            return;
          }

          warn(warning);
        },
      },
    },
  },
  nitro: {
    routeRules: {
      "/**": {
        headers: securityHeaders,
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
};

export default defineConfig(config as unknown as LovableConfig);
