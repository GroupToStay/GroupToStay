import { useEffect, useId, useMemo } from "react";
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
  const countriesQuery = useCountries();
  const citiesQuery = useCities(countryId);
  const countries = useMemo(() => countriesQuery.data ?? [], [countriesQuery.data]);
  const cities = useMemo(() => citiesQuery.data ?? [], [citiesQuery.data]);
  const countrySelectId = useId();
  const citySelectId = useId();
  const countryUnavailable =
    countriesQuery.isPending || countriesQuery.isError || countries.length === 0;
  const cityUnavailable =
    !countryId || citiesQuery.isPending || citiesQuery.isError || cities.length === 0;
  const countryPlaceholder = countriesQuery.isPending
    ? t("forms.country.loading")
    : countriesQuery.isError
      ? t("forms.country.error")
      : countries.length === 0
        ? t("forms.country.empty")
        : t("common.selectCountry");
  const cityPlaceholder = !countryId
    ? t("common.selectCountryFirst")
    : citiesQuery.isPending
      ? t("forms.city.loading")
      : citiesQuery.isError
        ? t("forms.city.error")
        : cities.length === 0
          ? t("forms.city.empty")
          : t("common.selectCity");

  // Clear city when country changes and current city doesn't belong
  useEffect(() => {
    if (cityId && cities.length && !cities.some((c) => c.id === cityId)) {
      onChange({ countryId, cityId: null });
    }
  }, [countryId, cities, cityId, onChange]);

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <Label htmlFor={countrySelectId}>
          {labelCountry ?? t("common.country")}
          {required && " *"}
        </Label>
        <Select
          value={countryId ?? ""}
          onValueChange={(v) => onChange({ countryId: v || null, cityId: null })}
          disabled={countryUnavailable}
        >
          <SelectTrigger
            id={countrySelectId}
            aria-label={labelCountry ?? t("common.country")}
            aria-busy={countriesQuery.isPending}
          >
            <SelectValue placeholder={countryPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {countries.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {localized(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <LookupStatus
          loading={countriesQuery.isPending}
          error={countriesQuery.isError}
          empty={!countriesQuery.isPending && !countriesQuery.isError && countries.length === 0}
          loadingText={t("forms.country.loading")}
          errorText={t("forms.country.error")}
          emptyText={t("forms.country.empty")}
          retryText={t("common.retry")}
          onRetry={() => void countriesQuery.refetch()}
        />
      </div>
      <div>
        <Label htmlFor={citySelectId}>
          {labelCity ?? t("common.city")}
          {required && " *"}
        </Label>
        <Select
          value={cityId ?? ""}
          onValueChange={(v) => onChange({ countryId, cityId: v || null })}
          disabled={cityUnavailable}
        >
          <SelectTrigger
            id={citySelectId}
            aria-label={labelCity ?? t("common.city")}
            aria-busy={Boolean(countryId && citiesQuery.isPending)}
          >
            <SelectValue placeholder={cityPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {localized(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {countryId ? (
          <LookupStatus
            loading={citiesQuery.isPending}
            error={citiesQuery.isError}
            empty={!citiesQuery.isPending && !citiesQuery.isError && cities.length === 0}
            loadingText={t("forms.city.loading")}
            errorText={t("forms.city.error")}
            emptyText={t("forms.city.empty")}
            retryText={t("common.retry")}
            onRetry={() => void citiesQuery.refetch()}
          />
        ) : null}
      </div>
    </div>
  );
}

function LookupStatus({
  loading,
  error,
  empty,
  loadingText,
  errorText,
  emptyText,
  retryText,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  loadingText: string;
  errorText: string;
  emptyText: string;
  retryText: string;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <p className="mt-1 text-xs text-muted-foreground" role="status" aria-live="polite">
        {loadingText}
      </p>
    );
  }

  if (error) {
    return (
      <div className="mt-1 flex items-center gap-2 text-xs text-destructive" role="alert">
        <span>{errorText}</span>
        <button
          type="button"
          className="font-medium underline underline-offset-2"
          onClick={onRetry}
        >
          {retryText}
        </button>
      </div>
    );
  }

  if (empty) {
    return (
      <p className="mt-1 text-xs text-muted-foreground" role="status">
        {emptyText}
      </p>
    );
  }

  return null;
}
