// Shared URL search-param serialization for RFQ handoff between the
// Homepage Quick Request form and /request-quote. Keep this the single source
// of truth for the encoding so both sides stay in sync.

import {
  ACCOMMODATION_TYPES,
  MEAL_PLANS,
  parseCategoriesParam,
  type AccommodationType,
  type HotelCategory,
  type MealPlan,
} from "./rfq-options";
import type { RfqSharedValues } from "./RfqSharedFields";

export type RfqSearchParams = {
  city?: string;
  country?: string;
  country_id?: string;
  city_id?: string;
  guests?: string;
  rooms?: string;
  check_in?: string;
  check_out?: string;
  accommodation?: string;
  meal_plan?: string;
  category?: string;
  requirements?: string;
};

export function validateRfqSearch(s: Record<string, unknown>): RfqSearchParams {
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : undefined);
  return {
    city: str("city"),
    country: str("country"),
    country_id: str("country_id"),
    city_id: str("city_id"),
    guests: str("guests"),
    rooms: str("rooms"),
    check_in: str("check_in"),
    check_out: str("check_out"),
    accommodation: str("accommodation"),
    meal_plan: str("meal_plan"),
    category: str("category"),
    requirements: str("requirements"),
  };
}

export function sharedValuesFromSearch(
  search: RfqSearchParams,
  defaults?: Partial<RfqSharedValues>,
): RfqSharedValues {
  const accom = search.accommodation;
  const meal = search.meal_plan;
  return {
    destination_country_id: search.country_id ?? defaults?.destination_country_id ?? null,
    destination_city_id: search.city_id ?? defaults?.destination_city_id ?? null,
    guests_count: search.guests ? Number(search.guests) || null : (defaults?.guests_count ?? null),
    rooms_needed: search.rooms ? Number(search.rooms) || null : (defaults?.rooms_needed ?? null),
    check_in: search.check_in ?? defaults?.check_in ?? "",
    check_out: search.check_out ?? defaults?.check_out ?? "",
    hotel_categories_v2: parseCategoriesParam(search.category).length
      ? parseCategoriesParam(search.category)
      : (defaults?.hotel_categories_v2 ?? []),
    accommodation_type:
      accom && (ACCOMMODATION_TYPES as readonly string[]).includes(accom)
        ? (accom as AccommodationType)
        : (defaults?.accommodation_type ?? "any"),
    meal_plan_code:
      meal && (MEAL_PLANS as readonly string[]).includes(meal)
        ? (meal as MealPlan)
        : (defaults?.meal_plan_code ?? "bb"),
    requirements: search.requirements ?? defaults?.requirements ?? "",
  };
}

export function sharedValuesToSearch(v: RfqSharedValues): Record<string, string> {
  const params: Record<string, string> = {};
  if (v.destination_country_id) params.country_id = v.destination_country_id;
  if (v.destination_city_id) params.city_id = v.destination_city_id;
  if (v.guests_count) params.guests = String(v.guests_count);
  if (v.rooms_needed) params.rooms = String(v.rooms_needed);
  if (v.check_in) params.check_in = v.check_in;
  if (v.check_out) params.check_out = v.check_out;
  if (v.accommodation_type && v.accommodation_type !== "any") {
    params.accommodation = v.accommodation_type;
  }
  if (v.meal_plan_code) params.meal_plan = v.meal_plan_code;
  if (v.hotel_categories_v2.length) params.category = v.hotel_categories_v2.join(",");
  if (v.requirements.trim()) params.requirements = v.requirements;
  return params;
}

// Re-export type alias so consumers don't need to import from two places.
export type { HotelCategory, AccommodationType, MealPlan };
