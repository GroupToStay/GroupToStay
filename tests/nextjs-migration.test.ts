import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canUseMarketplaceRoute,
  isProtectedRoute,
  safeAuthRedirect,
} from "../src/lib/auth/route-policy";

const root = resolve(process.cwd());

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("Next.js routing migration", () => {
  it("guards every authenticated route at the request and server-layout layers", () => {
    expect(isProtectedRoute("/dashboard/rfqs/123")).toBe(true);
    expect(isProtectedRoute("/admin/users")).toBe(true);
    expect(isProtectedRoute("/deals/123")).toBe(true);
    expect(isProtectedRoute("/request-quote")).toBe(false);

    const proxy = read("src/proxy.ts");
    const layout = read("src/app/(authenticated)/layout.tsx");
    expect(proxy).toContain("supabase.auth.getUser()");
    expect(proxy).toContain("isProtectedRoute(pathname)");
    expect(layout).toContain("await requireAuthenticatedUser()");
  });

  it("sanitizes deep-link return targets", () => {
    expect(safeAuthRedirect("/dashboard/rfqs/abc?tab=offers")).toBe(
      "/dashboard/rfqs/abc?tab=offers",
    );
    expect(safeAuthRedirect("https://attacker.example")).toBe("/dashboard");
    expect(safeAuthRedirect("//attacker.example")).toBe("/dashboard");
    expect(safeAuthRedirect("/auth?redirect=/admin")).toBe("/dashboard");
  });

  it("separates admin, Agency, and Supplier route authority", () => {
    expect(canUseMarketplaceRoute(["hotel"], "hotel")).toBe(true);
    expect(canUseMarketplaceRoute(["hotel"], "organizer")).toBe(false);
    expect(canUseMarketplaceRoute(["organizer"], "organizer")).toBe(true);
    expect(canUseMarketplaceRoute(["organizer"], "hotel")).toBe(false);
    expect(canUseMarketplaceRoute(["admin"], "participant")).toBe(false);
  });

  it("uses native redirects for legacy redirect-only routes", () => {
    expect(read("src/app/(public)/subscription/checkout/page.tsx")).toContain(
      'redirect("/subscription/coming-soon")',
    );
    expect(read("src/app/(authenticated)/dashboard/profile/page.tsx")).toContain(
      'redirect("/settings?tab=profile")',
    );
    expect(read("src/app/(authenticated)/dashboard/admin/page.tsx")).toContain(
      "LEGACY_ADMIN_TARGETS",
    );
  });

  it("does not retain the route-object page rendering shim", () => {
    const appFiles = walk(resolve(root, "src/app")).filter((path) => path.endsWith(".tsx"));
    const appSource = appFiles.map((path) => readFileSync(path, "utf8")).join("\n");
    expect(appSource).not.toContain("LegacyRoutePage");
    expect(appSource).not.toContain("Route.options.component");
  });

  it("ships canonical metadata, sitemap, robots, and security headers", () => {
    expect(read("src/app/layout.tsx")).toContain("https://group-to-stay.vercel.app");
    expect(read("src/app/sitemap.ts")).toContain("https://group-to-stay.vercel.app");
    expect(read("src/app/robots.ts")).toContain("/deals/");
    const nextConfig = read("next.config.ts");
    expect(nextConfig).toContain("Content-Security-Policy");
    expect(nextConfig).toContain("Strict-Transport-Security");
    expect(nextConfig).toContain("frame-ancestors 'self'");
    expect(read("src/app/(public)/hotels/[id]/page.tsx")).toContain("generateMetadata");
    expect(read("src/app/(public)/requests/[id]/page.tsx")).not.toContain('"/requests/[id]"');
  });
});
