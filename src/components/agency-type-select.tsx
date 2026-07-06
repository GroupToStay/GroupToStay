import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGENCY_TYPES, type AgencyType } from "@/lib/role-label";
import { useTranslation } from "react-i18next";

export function AgencyTypeSelect({
  value,
  onChange,
  required,
  label,
}: {
  value: string | null;
  onChange: (v: AgencyType) => void;
  required?: boolean;
  label?: string;
}) {
  const { t } = useTranslation();
  const displayLabel = label ?? t("forms.agencyType.label");
  const selectId = useId();

  return (
    <div>
      <Label htmlFor={selectId}>
        {displayLabel} {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value ?? ""} onValueChange={(v) => onChange(v as AgencyType)}>
        <SelectTrigger id={selectId} aria-label={displayLabel}>
          <SelectValue placeholder={t("forms.agencyType.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {AGENCY_TYPES.map((k) => (
            <SelectItem key={k} value={k}>
              {t(`forms.agencyTypes.${k}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
