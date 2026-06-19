import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

export type LookupRow = { id: string; name_en: string; name_ar: string };
export type CityRow = LookupRow & { country_id: string };

export function useLocalizedName() {
  const { i18n } = useTranslation();
  const ar = i18n.language?.startsWith("ar");
  return (row: { name_en?: string | null; name_ar?: string | null } | null | undefined) =>
    row ? (ar ? row.name_ar || row.name_en || "" : row.name_en || row.name_ar || "") : "";
}

export function useCountries() {
  return useQuery({
    queryKey: ["master-countries"],
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<LookupRow[]> => {
      const { data, error } = await supabase
        .from("countries")
        .select("id,name_en,name_ar")
        .eq("is_active", true)
        .order("name_en");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCities(countryId?: string | null) {
  return useQuery({
    queryKey: ["master-cities", countryId ?? "all"],
    enabled: true,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<CityRow[]> => {
      let q = supabase.from("cities").select("id,country_id,name_en,name_ar").eq("is_active", true).order("name_en");
      if (countryId) q = q.eq("country_id", countryId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useHotelTypes() {
  return useQuery({
    queryKey: ["master-hotel-types"],
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<LookupRow[]> => {
      const { data, error } = await supabase.from("hotel_types").select("id,name_en,name_ar").eq("is_active", true).order("name_en");
      if (error) throw error;
      return data ?? [];
    },
  });
}
