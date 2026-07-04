import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCountries, useCities, useLocalizedName } from "@/hooks/use-master-data";

type Props = {
  countryId: string | null;
  cityId: string | null;
  onChange: (next: { countryId: string | null; cityId: string | null }) => void;
  labelCountry?: string;
  labelCity?: string;
  required?: boolean;
};

export function CountryCitySelect({
  countryId,
  cityId,
  onChange,
  labelCountry,
  labelCity,
  required,
}: Props) {
  const { t } = useTranslation();
  const localized = useLocalizedName();
  const { data: countries = [] } = useCountries();
  const { data: cities = [] } = useCities(countryId);

  // Clear city when country changes and current city doesn't belong
  useEffect(() => {
    if (cityId && cities.length && !cities.some((c) => c.id === cityId)) {
      onChange({ countryId, cityId: null });
    }
  }, [countryId, cities, cityId, onChange]);

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <Label>
          {labelCountry ?? t("common.country", { defaultValue: "Country" })}
          {required && " *"}
        </Label>
        <Select
          value={countryId ?? ""}
          onValueChange={(v) => onChange({ countryId: v || null, cityId: null })}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={t("common.selectCountry", { defaultValue: "Select country" })}
            />
          </SelectTrigger>
          <SelectContent>
            {countries.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {localized(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>
          {labelCity ?? t("common.city", { defaultValue: "City" })}
          {required && " *"}
        </Label>
        <Select
          value={cityId ?? ""}
          onValueChange={(v) => onChange({ countryId, cityId: v || null })}
          disabled={!countryId}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                countryId
                  ? t("common.selectCity", { defaultValue: "Select city" })
                  : t("common.selectCountryFirst", { defaultValue: "Select country first" })
              }
            />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {localized(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
