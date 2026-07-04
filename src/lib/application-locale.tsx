import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { applyLocale } from "@/lib/i18n";
import {
  compareText,
  formatDateKey,
  formatDateTimeValue,
  formatDateValue,
  formatMonthShort,
  formatNumberValue,
  formatTimeValue,
  getHtmlLang,
  getIntlLocale,
  getTextDirection,
  normalizeAppLanguage,
  type AppLanguage,
  type TextDirection,
} from "@/lib/locale";

type ApplicationLocaleContextValue = {
  language: AppLanguage;
  htmlLang: AppLanguage;
  dir: TextDirection;
  intlLocale: string;
  setLanguage: (language: string) => Promise<void>;
  compare: (a: string, b: string, options?: Intl.CollatorOptions) => number;
  formatDateKey: (date: Date) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatMonthShort: (date: Date) => string;
  formatNumber: (value: number | string, options?: Intl.NumberFormatOptions) => string;
};

const defaultLocaleContext: ApplicationLocaleContextValue = {
  language: "en",
  htmlLang: "en",
  dir: "ltr",
  intlLocale: "en-US",
  setLanguage: async () => undefined,
  compare: (a, b, options) => compareText(a, b, "en", options),
  formatDateKey,
  formatDate: (value, options) => formatDateValue(value, "en", options),
  formatDateTime: (value, options) => formatDateTimeValue(value, "en", options),
  formatTime: (value, options) => formatTimeValue(value, "en", options),
  formatMonthShort: (date) => formatMonthShort(date, "en"),
  formatNumber: (value, options) => formatNumberValue(value, "en", options),
};

const ApplicationLocaleContext = createContext<ApplicationLocaleContextValue>(defaultLocaleContext);

export function ApplicationLocaleProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.language);

  useEffect(() => {
    applyLocale(language);
  }, [language]);

  const setLanguage = useCallback(
    async (nextLanguage: string) => {
      const normalized = normalizeAppLanguage(nextLanguage);
      await i18n.changeLanguage(normalized);
      applyLocale(normalized);
    },
    [i18n],
  );

  const value = useMemo<ApplicationLocaleContextValue>(
    () => ({
      language,
      htmlLang: getHtmlLang(language),
      dir: getTextDirection(language),
      intlLocale: getIntlLocale(language),
      setLanguage,
      compare: (a, b, options) => compareText(a, b, language, options),
      formatDateKey,
      formatDate: (dateValue, options) => formatDateValue(dateValue, language, options),
      formatDateTime: (dateValue, options) => formatDateTimeValue(dateValue, language, options),
      formatTime: (dateValue, options) => formatTimeValue(dateValue, language, options),
      formatMonthShort: (date) => formatMonthShort(date, language),
      formatNumber: (numberValue, options) => formatNumberValue(numberValue, language, options),
    }),
    [language, setLanguage],
  );

  return (
    <ApplicationLocaleContext.Provider value={value}>{children}</ApplicationLocaleContext.Provider>
  );
}

export function useApplicationLocale() {
  return useContext(ApplicationLocaleContext);
}
