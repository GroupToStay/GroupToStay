import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  HOTEL_CATEGORIES,
  HOTEL_CATEGORY_TRANSLATION_KEYS,
  type HotelCategory,
} from "./rfq-options";
import { useTranslation } from "react-i18next";

type Props = {
  value: HotelCategory[];
  onChange: (v: HotelCategory[]) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Shared searchable multi-select for RFQ Categories.
 * Empty selection === "Any" (backward compatible with existing RFQ storage).
 */
export function RfqCategoriesMultiSelect({ value, onChange, placeholder, className }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(value), [value]);

  const toggle = (v: HotelCategory) => {
    const next = selectedSet.has(v) ? value.filter((x) => x !== v) : [...value, v];
    onChange(next);
  };
  const clear = () => onChange([]);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
              {value.length === 0
                ? (placeholder ?? t("rfq.categories.any"))
                : t("rfq.categories.selectedCount", { count: value.length })}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]"
          align="start"
        >
          <Command>
            <CommandInput placeholder={t("rfq.categories.searchPlaceholder")} />
            <CommandList>
              <CommandEmpty>{t("rfq.categories.empty")}</CommandEmpty>
              <CommandGroup>
                {HOTEL_CATEGORIES.map((c) => {
                  const active = selectedSet.has(c);
                  return (
                    <CommandItem key={c} value={c} onSelect={() => toggle(c)}>
                      <Check className={cn("mr-2 h-4 w-4", active ? "opacity-100" : "opacity-0")} />
                      {t(HOTEL_CATEGORY_TRANSLATION_KEYS[c])}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {t(HOTEL_CATEGORY_TRANSLATION_KEYS[v])}
              <button
                type="button"
                onClick={() => toggle(v)}
                aria-label={t("rfq.categories.remove", {
                  category: t(HOTEL_CATEGORY_TRANSLATION_KEYS[v]),
                })}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={clear}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            {t("buttons.clear")}
          </button>
        </div>
      )}
    </div>
  );
}
