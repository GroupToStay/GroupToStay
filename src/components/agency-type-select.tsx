import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AGENCY_TYPES, AGENCY_TYPE_LABELS, type AgencyType } from "@/lib/role-label";

export function AgencyTypeSelect({
  value,
  onChange,
  required,
  label = "Agency type",
}: {
  value: string | null;
  onChange: (v: AgencyType) => void;
  required?: boolean;
  label?: string;
}) {
  return (
    <div>
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value ?? ""} onValueChange={(v) => onChange(v as AgencyType)}>
        <SelectTrigger>
          <SelectValue placeholder="Select agency type…" />
        </SelectTrigger>
        <SelectContent>
          {AGENCY_TYPES.map((k) => (
            <SelectItem key={k} value={k}>
              {AGENCY_TYPE_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
