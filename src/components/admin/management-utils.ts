import { formatNumberValue, type AppLanguage } from "@/lib/locale";

export function getPageSlice<T>(rows: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function formatAdminDate(value?: string | null) {
  if (!value) return "-";
  const dateOnly = value.includes("T") ? value.slice(0, 10) : value;
  const [year, month, day] = dateOnly.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

export function formatCompactNumber(value: number, language: AppLanguage = "en") {
  return formatNumberValue(value, language, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}
