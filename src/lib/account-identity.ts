export type DisplayRole = "admin" | "super_admin" | "organizer" | "agency" | "hotel" | "visitor";

export function getInitials(value?: string | null) {
  const words = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "GS";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function normalizeDisplayRole(role?: string | null): DisplayRole {
  const normalized = String(role ?? "visitor").toLowerCase();
  if (normalized === "admin" || normalized === "super_admin") return normalized;
  if (normalized === "hotel") return "hotel";
  if (normalized === "organizer" || normalized === "agency") return "agency";
  return "visitor";
}

export function isAdminDisplayRole(role: DisplayRole) {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdminDisplayRole(role: DisplayRole) {
  return role === "super_admin";
}
