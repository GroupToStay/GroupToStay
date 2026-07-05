import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  min?: string; // YYYY-MM-DD
  disablePast?: boolean;
  placeholder?: string;
  className?: string;
};

/** Shared MM/DD/YYYY date picker used by all RFQ forms. */
export function RfqDatePickerField({
  value,
  onChange,
  min,
  disablePast = true,
  placeholder = "MM/DD/YYYY",
  className,
}: Props) {
  const date = value ? new Date(value) : undefined;
  const minDate = min ? new Date(min) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-start font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="me-2 h-4 w-4" />
          {date ? format(date, "MM/dd/yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
          disabled={(d) => {
            if (disablePast) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (d < today) return true;
            }
            if (minDate && d <= minDate) return true;
            return false;
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
