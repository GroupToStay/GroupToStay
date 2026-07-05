import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  getHtmlLang,
  getStoredAppLanguage,
  getTextDirection,
  normalizeAppLanguage,
  setStoredAppLanguage,
  SUPPORTED_APP_LANGUAGES,
} from "@/lib/locale";
import { applyNoTranslateAttributes } from "@/lib/translation-hardening";

type TranslationResource = Record<string, unknown>;
type LanguageResources = Record<string, TranslationResource>;

export const I18N_NAMESPACES = [
  "common",
  "navigation",
  "landing",
  "auth",
  "admin",
  "dashboard",
  "hotel",
  "rfq",
  "forms",
  "validation",
  "errors",
  "notifications",
  "legal",
  "profile",
  "pricing",
  "company",
  "subscriptions",
  "buttons",
  "legacy",
] as const;

const localeModules = import.meta.glob("../locales/*/*.json", {
  eager: true,
  import: "default",
}) as Record<string, TranslationResource>;

function deepMerge(target: TranslationResource, source: TranslationResource) {
  Object.entries(source).forEach(([key, value]) => {
    const current = target[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      deepMerge(current as TranslationResource, value as TranslationResource);
      return;
    }

    target[key] = value;
  });

  return target;
}

function buildResources() {
  const resources: Record<string, LanguageResources> = {};

  Object.entries(localeModules).forEach(([modulePath, resource]) => {
    const match = modulePath.match(/\/locales\/([^/]+)\/([^/]+)\.json$/);
    if (!match) return;

    const [, language, namespace] = match;
    resources[language] ??= {};
    resources[language][namespace] = resource;
  });

  Object.values(SUPPORTED_APP_LANGUAGES).forEach((language) => {
    const languageResources = resources[language] ?? {};
    languageResources.translation = I18N_NAMESPACES.reduce<TranslationResource>(
      (merged, namespace) => deepMerge(merged, languageResources[namespace] ?? {}),
      {},
    );
    resources[language] = languageResources;
  });

  return resources;
}

// Default language is ALWAYS English so first render is deterministic
// (SSR + client) and never mixes Arabic with English. Arabic is opt-in
// via the LanguageSwitcher which persists the choice in localStorage.
function initialLanguage(): "en" | "ar" {
  return getStoredAppLanguage();
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: buildResources(),
    lng: "en", // deterministic first render — client hydration matches server
    fallbackLng: "en",
    defaultNS: "translation",
    ns: ["translation", ...I18N_NAMESPACES],
    supportedLngs: [...SUPPORTED_APP_LANGUAGES],
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    returnNull: false,
    react: { useSuspense: false },
  });

  // After hydration, restore any previously-saved Arabic preference.
  if (typeof window !== "undefined") {
    const saved = initialLanguage();
    if (saved !== i18n.language) {
      // Defer to after first paint to avoid hydration mismatch.
      queueMicrotask(() => {
        i18n.changeLanguage(saved);
        applyLocale(saved);
      });
    }
  }
}

export default i18n;

export function applyLocale(lang: string) {
  if (typeof document === "undefined") return;
  const language = normalizeAppLanguage(lang);
  document.documentElement.lang = getHtmlLang(language);
  document.documentElement.dir = getTextDirection(language);
  applyNoTranslateAttributes(language);
  setStoredAppLanguage(language);
}
