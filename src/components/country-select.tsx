import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCountries, useLocalizedName, type LookupRow } from "@/hooks/use-master-data";
import { cn } from "@/lib/utils";

// Hard-coded fallback (matches DB seed) so the dropdown is never empty
// even if the network/RLS fails. id === code so the auth form can still
// resolve the country name; the trigger persists the ISO code as country.
const FALLBACK: LookupRow[] = [
  { id: "SA", name_en: "Saudi Arabia", name_ar: "المملكة العربية السعودية" },
  { id: "AE", name_en: "United Arab Emirates", name_ar: "الإمارات العربية المتحدة" },
  { id: "EG", name_en: "Egypt", name_ar: "مصر" },
  { id: "KW", name_en: "Kuwait", name_ar: "الكويت" },
  { id: "BH", name_en: "Bahrain", name_ar: "البحرين" },
  { id: "OM", name_en: "Oman", name_ar: "عُمان" },
  { id: "QA", name_en: "Qatar", name_ar: "قطر" },
  { id: "JO", name_en: "Jordan", name_ar: "الأردن" },
  { id: "MA", name_en: "Morocco", name_ar: "المغرب" },
  { id: "TR", name_en: "Turkey", name_ar: "تركيا" },
];

export function CountrySelect({
  value,
  onChange,
  placeholder = "Select country",
  filterCodes,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  /** If provided, only countries with these ISO codes (case-insensitive) are shown. */
  filterCodes?: string[];
}) {
  const { data, isLoading, isError } = useCountries();
  const localized = useLocalizedName();
  const [open, setOpen] = useState(false);

  const countries = useMemo(() => {
    const base = (data && data.length > 0 ? data : isError || !isLoading ? FALLBACK : []) as Array<
      LookupRow & { code?: string }
    >;
    if (!filterCodes || filterCodes.length === 0) return base;
    const allow = new Set(filterCodes.map((c) => c.toUpperCase()));
    return base.filter((c) => {
      const code = (c.code ?? c.id ?? "").toUpperCase();
      return allow.has(code);
    });
  }, [data, isError, isLoading, filterCodes]);

  const selected = countries.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected
              ? localized(selected)
              : isLoading && countries.length === 0
                ? "Loading countries..."
                : placeholder}
          </span>
          {isLoading && countries.length === 0 ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 opacity-50 animate-spin" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countries.map((c) => {
                const label = localized(c);
                return (
                  <CommandItem
                    key={c.id}
                    value={`${c.name_en} ${c.name_ar ?? ""}`}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")}
                    />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
