// Top-level reusable RFQ field section.
// Rendered by BOTH the Homepage Quick Request (src/routes/index.tsx) and the
// full wizard (src/routes/request-quote.tsx). Any change to a shared RFQ field
// should happen here — do not re-assemble these fields elsewhere.

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryCitySelect } from "@/components/country-city-select";
import { RfqDatePickerField } from "./RfqDatePickerField";
import { RfqCategoriesMultiSelect } from "./RfqCategoriesMultiSelect";
import { RfqAccommodationSelect, RfqMealPlanSelect } from "./RfqEnumSelects";
import { RfqRequirementsField } from "./RfqRequirementsField";
import { BedDouble, Calendar, Hotel, Star, Users } from "lucide-react";
import type { AccommodationType, HotelCategory, MealPlan } from "./rfq-options";
import { useTranslation } from "react-i18next";

export type RfqSharedValues = {
  destination_country_id: string | null;
  destination_city_id: string | null;
  guests_count: number | null;
  rooms_needed: number | null;
  check_in: string;
  check_out: string;
  hotel_categories_v2: HotelCategory[];
  accommodation_type: AccommodationType;
  meal_plan_code: MealPlan;
  requirements: string;
};

export type RfqSharedSection =
  "destination" | "counts" | "dates" | "categories" | "accommodation" | "mealPlan" | "requirements";

type Props = {
  value: RfqSharedValues;
  onChange: (patch: Partial<RfqSharedValues>) => void;
  /** "compact" = homepage single-card grid. "stacked" = wizard vertical layout. */
  variant?: "compact" | "stacked";
  /** Optional restriction of which sections to render. Defaults to all. */
  sections?: RfqSharedSection[];
  /** Required marker on destination selects. */
  destinationRequired?: boolean;
  destinationLabels?: { country?: string; city?: string };
  requirementsHint?: ReactNode;
};

const ALL: RfqSharedSection[] = [
  "destination",
  "counts",
  "dates",
  "categories",
  "accommodation",
  "mealPlan",
  "requirements",
];

export function RfqSharedFields({
  value,
  onChange,
  variant = "stacked",
  sections = ALL,
  destinationRequired,
  destinationLabels,
  requirementsHint,
}: Props) {
  const { t } = useTranslation();
  const has = (s: RfqSharedSection) => sections.includes(s);
  const compact = variant === "compact";

  const destination = has("destination") && (
    <CountryCitySelect
      countryId={value.destination_country_id}
      cityId={value.destination_city_id}
      onChange={({ countryId, cityId }) =>
        onChange({ destination_country_id: countryId, destination_city_id: cityId })
      }
      labelCountry={destinationLabels?.country ?? t("rfq.fields.destCountry")}
      labelCity={destinationLabels?.city ?? t("rfq.fields.destCity")}
      required={destinationRequired}
    />
  );

  const groupSize = has("counts") && (
    <LabeledField compact={compact} icon={Users} label={t("rfq.fields.groupSize")}>
      <Input
        type="number"
        min={1}
        placeholder="120"
        value={value.guests_count ?? ""}
        onChange={(e) => onChange({ guests_count: e.target.value ? Number(e.target.value) : null })}
      />
    </LabeledField>
  );
  const rooms = has("counts") && (
    <LabeledField compact={compact} icon={BedDouble} label={t("rfq.fields.rooms")}>
      <Input
        type="number"
        min={1}
        placeholder="40"
        value={value.rooms_needed ?? ""}
        onChange={(e) => onChange({ rooms_needed: e.target.value ? Number(e.target.value) : null })}
      />
    </LabeledField>
  );
  const checkIn = has("dates") && (
    <LabeledField compact={compact} icon={Calendar} label={t("rfq.fields.checkIn")}>
      <RfqDatePickerField value={value.check_in} onChange={(v) => onChange({ check_in: v })} />
    </LabeledField>
  );
  const checkOut = has("dates") && (
    <LabeledField compact={compact} icon={Calendar} label={t("rfq.fields.checkOut")}>
      <RfqDatePickerField
        value={value.check_out}
        onChange={(v) => onChange({ check_out: v })}
        min={value.check_in}
      />
    </LabeledField>
  );

  const categories = has("categories") && (
    <LabeledField compact={compact} icon={Star} label={t("rfq.fields.categories")}>
      <RfqCategoriesMultiSelect
        value={value.hotel_categories_v2}
        onChange={(v) => onChange({ hotel_categories_v2: v })}
      />
    </LabeledField>
  );
  const accommodation = has("accommodation") && (
    <LabeledField compact={compact} icon={Hotel} label={t("rfq.fields.accommodation")}>
      <RfqAccommodationSelect
        value={value.accommodation_type}
        onChange={(v) => onChange({ accommodation_type: v })}
      />
    </LabeledField>
  );
  const mealPlan = has("mealPlan") && (
    <LabeledField compact={compact} icon={BedDouble} label={t("rfq.fields.mealPlan")}>
      <RfqMealPlanSelect
        value={value.meal_plan_code}
        onChange={(v) => onChange({ meal_plan_code: v })}
      />
    </LabeledField>
  );

  const requirements = has("requirements") && (
    <div>
      <Label className={compact ? "text-xs text-muted-foreground font-medium" : ""}>
        {t("rfq.fields.requirementsOptional")}
      </Label>
      {requirementsHint ? (
        <p className="text-xs text-muted-foreground mt-0.5">{requirementsHint}</p>
      ) : null}
      <div className={compact ? "mt-1.5" : "mt-1"}>
        <RfqRequirementsField
          value={value.requirements}
          onChange={(v) => onChange({ requirements: v })}
          rows={compact ? 4 : 6}
        />
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-3">
        {destination}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {groupSize}
          {rooms}
          {checkIn}
          {checkOut}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {categories}
          {accommodation}
          {mealPlan}
        </div>
        {requirements}
      </div>
    );
  }

  // stacked (wizard) — sections are rendered in a single column; callers can
  // pass a subset per step.
  return (
    <div className="space-y-4">
      {destination}
      {(groupSize || rooms) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groupSize}
          {rooms}
        </div>
      )}
      {(checkIn || checkOut) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {checkIn}
          {checkOut}
        </div>
      )}
      {categories}
      {(accommodation || mealPlan) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {accommodation}
          {mealPlan}
        </div>
      )}
      {requirements}
    </div>
  );
}

function LabeledField({
  compact,
  icon: Icon,
  label,
  children,
}: {
  compact: boolean;
  icon: any;
  label: string;
  children: ReactNode;
}) {
  if (compact) {
    return (
      <div>
        <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 mb-1.5">
          <Icon className="h-3.5 w-3.5" /> {label}
        </Label>
        {children}
      </div>
    );
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
