// Maps internal role identifiers to the user-facing label.
// The database role string remains "organizer" to preserve existing rows and RLS;
// the platform brand label is now "Agency".
import type { TFunction } from "i18next";

export function roleLabel(role: string | null | undefined, t?: TFunction): string {
  switch (role) {
    case "organizer":
    case "agency":
      return t ? t("role.agency", { defaultValue: "Agency" }) : "Agency";
    case "hotel":
      return t ? t("role.hotel", { defaultValue: "Hotel" }) : "Hotel";
    case "admin":
      return t ? t("role.admin", { defaultValue: "Admin" }) : "Admin";
    default:
      return role ?? "";
  }
}

export const AGENCY_TYPES = [
  "umrah",
  "hajj",
  "travel",
  "tour_operator",
  "corporate",
  "event",
  "sports",
  "school",
  "government",
  "other",
] as const;

export type AgencyType = (typeof AGENCY_TYPES)[number];

export const AGENCY_TYPE_LABELS: Record<AgencyType, string> = {
  umrah: "Umrah Agency",
  hajj: "Hajj Agency",
  travel: "Travel Agency",
  tour_operator: "Tour Operator",
  corporate: "Corporate Travel",
  event: "Event Organizer",
  sports: "Sports Team",
  school: "School / University",
  government: "Government Entity",
  other: "Other",
};
