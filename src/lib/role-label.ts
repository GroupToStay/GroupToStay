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
