// Shared option constants for RFQ (Group Request) forms.
// Edit here to update both Homepage Quick Request and /request-quote.

export const HOTEL_CATEGORIES = [
  "Budget",
  "Economy",
  "Midscale",
  "Upper Midscale",
  "Upscale",
  "Luxury",
  "Resort",
  "Boutique Hotel",
  "Business Hotel",
  "Airport Hotel",
  "Beach Resort",
  "City Hotel",
  "Convention Hotel",
  "Serviced Apartments",
  "Hostel",
  "Villa",
  "Other",
] as const;

export type HotelCategory = (typeof HOTEL_CATEGORIES)[number];

export const HOTEL_CATEGORY_TRANSLATION_KEYS: Record<HotelCategory, string> = {
  Budget: "rfq.categories.budget",
  Economy: "rfq.categories.economy",
  Midscale: "rfq.categories.midscale",
  "Upper Midscale": "rfq.categories.upperMidscale",
  Upscale: "rfq.categories.upscale",
  Luxury: "rfq.categories.luxury",
  Resort: "rfq.categories.resort",
  "Boutique Hotel": "rfq.categories.boutiqueHotel",
  "Business Hotel": "rfq.categories.businessHotel",
  "Airport Hotel": "rfq.categories.airportHotel",
  "Beach Resort": "rfq.categories.beachResort",
  "City Hotel": "rfq.categories.cityHotel",
  "Convention Hotel": "rfq.categories.conventionHotel",
  "Serviced Apartments": "rfq.categories.servicedApartments",
  Hostel: "rfq.categories.hostel",
  Villa: "rfq.categories.villa",
  Other: "rfq.categories.other",
};

// Backward-compat aliases: normalize legacy stored category values into the
// current canonical list so old RFQs keep matching.
const CATEGORY_ALIASES: Record<string, HotelCategory> = {
  Boutique: "Boutique Hotel",
};

export function normalizeCategory(v: string): HotelCategory | null {
  if (!v) return null;
  const mapped = CATEGORY_ALIASES[v] ?? v;
  return (HOTEL_CATEGORIES as readonly string[]).includes(mapped)
    ? (mapped as HotelCategory)
    : null;
}

export function parseCategoriesParam(param: string | undefined | null): HotelCategory[] {
  if (!param) return [];
  return param
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== "any")
    .map(normalizeCategory)
    .filter((v): v is HotelCategory => !!v);
}

export const ACCOMMODATION_TYPES = ["any", "hotel", "hotel_apartment", "resort"] as const;
export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];

export const MEAL_PLANS = ["room_only", "bb", "hb", "fb"] as const;
export type MealPlan = (typeof MEAL_PLANS)[number];

// Legacy board_type mapping for back-compat writes.
export const MEAL_PLAN_TO_BOARD: Record<MealPlan, string> = {
  room_only: "room_only",
  bb: "breakfast",
  hb: "half_board",
  fb: "full_board",
};

export const REQUIREMENTS_MAX = 4000;
