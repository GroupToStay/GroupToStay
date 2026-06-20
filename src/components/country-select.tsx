import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCountries, useLocalizedName } from "@/hooks/use-master-data";

export function CountrySelect({
  value,
  onChange,
  placeholder = "Select country",
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}) {
  const { data: countries = [] } = useCountries();
  const localized = useLocalizedName();
  return (
    <Select value={value ?? ""} onValueChange={v => onChange(v || null)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {countries.map(c => <SelectItem key={c.id} value={c.id}>{localized(c)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
