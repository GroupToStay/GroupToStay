import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Production security headers. Deliberately permissive enough to keep
// Supabase (Auth / REST / Realtime / Storage), Google Fonts, images, and
// the Lovable preview shell working; strict enough to block clickjacking
// and unrelated third-party script injection.
function applySecurityHeaders(request: Request, response: Response): Response {
  const url = new URL(request.url);
  // Only rewrite HTML document responses — assets, JSON, etc. don't need CSP.
  const contentType = response.headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");

  const headers = new Headers(response.headers);

  // Broadly-safe headers on every response. Force-set (do not defer to any
  // upstream value) so production consistently emits the intended posture.
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  // CSP `frame-ancestors` (below, for HTML) is the modern clickjacking
  // control and stays permissive enough for the Lovable preview iframe.
  // XFO=SAMEORIGIN covers legacy UAs that ignore frame-ancestors while
  // remaining compatible with same-origin app framing.
  headers.set("x-frame-options", "SAMEORIGIN");
  if (url.protocol === "https:") {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  if (isHtml && !headers.has("content-security-policy")) {
    // Keep Lovable preview / editor working: allow lovable.app frame ancestors
    // and inline scripts (TanStack Start hydration payload uses inline script).
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.lovable.app https://*.lovable.dev",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.lovable.app https://*.lovable.dev",
      "frame-src 'self' https://*.lovable.app https://*.lovable.dev",
      "form-action 'self'",
    ].join("; ");
    headers.set("content-security-policy", csp);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return applySecurityHeaders(request, normalized);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        request,
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
