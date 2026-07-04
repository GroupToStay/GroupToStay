import { supabase } from "@/integrations/supabase/client";
import { MEAL_PLAN_TO_BOARD } from "./rfq-options";
import { RfqSchema, type RfqInput } from "./rfq-validation";

export type RfqSubmitContext = {
  userId: string;
  countryNameEn?: string;
  cityNameEn?: string;
};

export async function submitRfq(rawForm: unknown, ctx: RfqSubmitContext): Promise<{ id: string }> {
  const parsed: RfqInput = RfqSchema.parse(rawForm);
  const { data, error } = await supabase
    .from("rfqs")
    .insert({
      title: parsed.title,
      group_type: parsed.group_type,
      destination_country_id: parsed.destination_country_id,
      destination_city_id: parsed.destination_city_id,
      destination_country: ctx.countryNameEn ?? "",
      destination_city: ctx.cityNameEn ?? "",
      check_in: parsed.check_in,
      check_out: parsed.check_out,
      guests_count: parsed.guests_count,
      rooms_needed: parsed.rooms_needed,
      hotel_categories_v2:
        parsed.hotel_categories_v2 && parsed.hotel_categories_v2.length > 0
          ? parsed.hotel_categories_v2
          : null,
      accommodation_type: parsed.accommodation_type,
      meal_plan_code: parsed.meal_plan_code,
      board_type: MEAL_PLAN_TO_BOARD[parsed.meal_plan_code] as any,
      additional_requirements: parsed.additional_requirements || null,
      requirements: parsed.requirements || null,
      special_requirements: parsed.additional_requirements || parsed.requirements || null,
      deadline: parsed.deadline || null,
      currency: "USD",
      organizer_id: ctx.userId,
      status: "open",
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}
