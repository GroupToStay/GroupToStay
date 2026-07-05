import { z } from "zod";
import { ACCOMMODATION_TYPES, MEAL_PLANS, HOTEL_CATEGORIES, REQUIREMENTS_MAX } from "./rfq-options";
import i18n from "@/lib/i18n";

export const RfqSchema = z.object({
  title: z.string().min(3).max(160),
  group_type: z.enum([
    "umrah",
    "hajj",
    "tourism",
    "corporate",
    "government",
    "sports",
    "education",
    "event",
    "other",
  ]),
  destination_country_id: z.string().uuid({ message: i18n.t("validation.rfq.country") }),
  destination_city_id: z.string().uuid({ message: i18n.t("validation.rfq.city") }),
  check_in: z.string().min(1),
  check_out: z.string().min(1),
  guests_count: z.number().int().min(1).max(100000),
  rooms_needed: z.number().int().min(1).max(10000),
  hotel_categories_v2: z.array(z.enum(HOTEL_CATEGORIES)).optional(),
  accommodation_type: z.enum(ACCOMMODATION_TYPES),
  meal_plan_code: z.enum(MEAL_PLANS),
  additional_requirements: z.string().max(2000).optional().or(z.literal("")),
  requirements: z.string().max(REQUIREMENTS_MAX).optional().or(z.literal("")),
  deadline: z.string().optional().or(z.literal("")),
});

export type RfqInput = z.infer<typeof RfqSchema>;

// Shared step-level validators used by client UIs. Return an error message or null.
export function validateDestination(form: {
  title?: string;
  destination_country_id: string | null;
  destination_city_id: string | null;
}): string | null {
  if (form.title !== undefined) {
    if (!form.title.trim() || form.title.trim().length < 3) return i18n.t("validation.rfq.title");
  }
  if (!form.destination_country_id) return i18n.t("validation.rfq.destinationCountry");
  if (!form.destination_city_id) return i18n.t("validation.rfq.destinationCity");
  return null;
}

export function validateDatesAndCounts(form: {
  check_in: string;
  check_out: string;
  guests_count: number;
  rooms_needed: number;
}): string | null {
  if (!form.check_in) return i18n.t("validation.rfq.checkIn");
  if (!form.check_out) return i18n.t("validation.rfq.checkOut");
  const ci = new Date(form.check_in);
  const co = new Date(form.check_out);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (ci < today) return i18n.t("validation.rfq.checkInPast");
  if (co <= ci) return i18n.t("validation.rfq.checkoutAfterCheckin");
  if (!(form.guests_count > 0) || form.guests_count > 100000)
    return i18n.t("validation.rfq.guestsRange");
  if (!(form.rooms_needed > 0) || form.rooms_needed > 10000)
    return i18n.t("validation.rfq.roomsRange");
  return null;
}
