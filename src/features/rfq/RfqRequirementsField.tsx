import { Textarea } from "@/components/ui/textarea";
import { REQUIREMENTS_MAX, REQUIREMENTS_PLACEHOLDER } from "./rfq-options";

type Props = {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
};

/** Shared optional Requirements textarea with auto-expand and preserved line breaks. */
export function RfqRequirementsField({ value, onChange, rows = 6, className }: Props) {
  return (
    <Textarea
      rows={rows}
      maxLength={REQUIREMENTS_MAX}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      placeholder={REQUIREMENTS_PLACEHOLDER}
      className={"whitespace-pre-wrap " + (className ?? "")}
    />
  );
}
