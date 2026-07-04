export const APP_LANGUAGE_STORAGE_KEY = "gts_lang";
export const SUPPORTED_APP_LANGUAGES = ["en", "ar"] as const;

export type AppLanguage = (typeof SUPPORTED_APP_LANGUAGES)[number];
export type TextDirection = "ltr" | "rtl";

const DEFAULT_LANGUAGE: AppLanguage = "en";
const INTL_LOCALE_BY_LANGUAGE: Record<AppLanguage, string> = {
  en: "en-US",
  ar: "ar",
};

export function normalizeAppLanguage(value: unknown): AppLanguage {
  if (typeof value !== "string") return DEFAULT_LANGUAGE;
  const raw = value.trim();
  if (!raw) return DEFAULT_LANGUAGE;

  let language = "";
  try {
    language = new Intl.Locale(raw.replace(/_/g, "-")).language.toLowerCase();
  } catch {
    language = raw.split(/[-_]/)[0]?.toLowerCase() ?? "";
  }

  if (language === "ar") return "ar";
  if (language === "en") return "en";
  return DEFAULT_LANGUAGE;
}

export function getStoredAppLanguage(): AppLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    return normalizeAppLanguage(window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function setStoredAppLanguage(language: AppLanguage) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Locale persistence is best-effort in restricted browser contexts.
  }
}

export function getTextDirection(language: AppLanguage): TextDirection {
  return language === "ar" ? "rtl" : "ltr";
}

export function getHtmlLang(language: AppLanguage) {
  return language;
}

export function getIntlLocale(language: AppLanguage) {
  return INTL_LOCALE_BY_LANGUAGE[language] ?? INTL_LOCALE_BY_LANGUAGE.en;
}

function safeDateTimeFormatter(language: AppLanguage, options: Intl.DateTimeFormatOptions) {
  const safeOptions: Intl.DateTimeFormatOptions = {
    calendar: "gregory",
    numberingSystem: "latn",
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(getIntlLocale(language), safeOptions);
  } catch {
    return new Intl.DateTimeFormat(INTL_LOCALE_BY_LANGUAGE.en, safeOptions);
  }
}

function safeNumberFormatter(language: AppLanguage, options?: Intl.NumberFormatOptions) {
  const safeOptions: Intl.NumberFormatOptions = {
    numberingSystem: "latn",
    ...options,
  };

  try {
    return new Intl.NumberFormat(getIntlLocale(language), safeOptions);
  } catch {
    return new Intl.NumberFormat(INTL_LOCALE_BY_LANGUAGE.en, safeOptions);
  }
}

function toValidDate(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMonthShort(date: Date, language: AppLanguage) {
  return safeDateTimeFormatter(language, { month: "short" }).format(date);
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateValue(
  value: Date | string | number,
  language: AppLanguage,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
) {
  const date = toValidDate(value);
  if (!date) return "";
  return safeDateTimeFormatter(language, options).format(date);
}

export function formatDateTimeValue(
  value: Date | string | number,
  language: AppLanguage,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
) {
  const date = toValidDate(value);
  if (!date) return "";
  return safeDateTimeFormatter(language, options).format(date);
}

export function formatTimeValue(
  value: Date | string | number,
  language: AppLanguage,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
) {
  const date = toValidDate(value);
  if (!date) return "";
  return safeDateTimeFormatter(language, options).format(date);
}

export function formatNumberValue(
  value: number | string,
  language: AppLanguage,
  options?: Intl.NumberFormatOptions,
) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "";
  return safeNumberFormatter(language, options).format(number);
}

export function compareText(
  a: string,
  b: string,
  language: AppLanguage,
  options: Intl.CollatorOptions = { numeric: true, sensitivity: "base" },
) {
  try {
    return new Intl.Collator(getIntlLocale(language), options).compare(a, b);
  } catch {
    return new Intl.Collator(INTL_LOCALE_BY_LANGUAGE.en, options).compare(a, b);
  }
}
