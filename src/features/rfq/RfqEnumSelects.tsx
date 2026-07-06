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
import { useTranslation } from "react-i18next";

export function RfqAccommodationSelect({
  id,
  "aria-label": ariaLabel,
  value,
  onChange,
}: {
  id?: string;
  "aria-label"?: string;
  value: AccommodationType;
  onChange: (v: AccommodationType) => void;
}) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={(v) => onChange(v as AccommodationType)}>
      <SelectTrigger id={id} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ACCOMMODATION_TYPES.map((k) => (
          <SelectItem key={k} value={k}>
            {t(`rfq.accommodationTypes.${k}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RfqMealPlanSelect({
  id,
  "aria-label": ariaLabel,
  value,
  onChange,
}: {
  id?: string;
  "aria-label"?: string;
  value: MealPlan;
  onChange: (v: MealPlan) => void;
}) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={(v) => onChange(v as MealPlan)}>
      <SelectTrigger id={id} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MEAL_PLANS.map((k) => (
          <SelectItem key={k} value={k}>
            {t(`rfq.mealPlans.${k}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
