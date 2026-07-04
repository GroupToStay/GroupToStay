import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCOMMODATION_TYPES,
  MEAL_PLANS,
  type AccommodationType,
  type MealPlan,
} from "./rfq-options";

const ACC_LABELS: Record<AccommodationType, string> = {
  any: "Any",
  hotel: "Hotel",
  hotel_apartment: "Hotel Apartment",
  resort: "Resort",
};

const MEAL_LABELS: Record<MealPlan, string> = {
  room_only: "Room Only",
  bb: "Bed & Breakfast",
  hb: "Half Board",
  fb: "Full Board",
};

export function RfqAccommodationSelect({
  value,
  onChange,
}: {
  value: AccommodationType;
  onChange: (v: AccommodationType) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AccommodationType)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ACCOMMODATION_TYPES.map((k) => (
          <SelectItem key={k} value={k}>
            {ACC_LABELS[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RfqMealPlanSelect({
  value,
  onChange,
}: {
  value: MealPlan;
  onChange: (v: MealPlan) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as MealPlan)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MEAL_PLANS.map((k) => (
          <SelectItem key={k} value={k}>
            {MEAL_LABELS[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
