import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PHONE_CODES, DEFAULT_PHONE_CODE } from "@/lib/phone-codes";

export function PhoneInput({
  code,
  number,
  onCodeChange,
  onNumberChange,
  required,
}: {
  code: string | null | undefined;
  number: string;
  onCodeChange: (c: string) => void;
  onNumberChange: (n: string) => void;
  required?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <Select value={code || DEFAULT_PHONE_CODE} onValueChange={onCodeChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PHONE_CODES.map((p) => (
            <SelectItem key={p.code} value={p.code}>
              <span className="mr-2">{p.flag}</span>
              {p.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        inputMode="numeric"
        required={required}
        value={number}
        maxLength={15}
        onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ""))}
        placeholder="5XXXXXXXX"
      />
    </div>
  );
}
