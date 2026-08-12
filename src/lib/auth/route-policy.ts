export const PROTECTED_ROUTE_PREFIXES = ["/admin", "/dashboard", "/deals", "/settings"];

export function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function safeAuthRedirect(value: string | null | undefined) {
  const target = value?.trim();
  if (
    !target ||
    !target.startsWith("/") ||
    target.startsWith("//") ||
    target.includes("\\") ||
    target.startsWith("/auth")
  ) {
    return "/dashboard";
  }
  return target;
}

export function canUseMarketplaceRoute(
  roles: readonly string[],
  requirement: "hotel" | "organizer" | "participant",
) {
  if (roles.includes("admin")) return false;
  if (requirement === "hotel") return roles.includes("hotel");
  if (requirement === "organizer") return !roles.includes("hotel");
  return true;
}
