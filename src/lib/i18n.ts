import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import ar from "@/locales/ar.json";
import {
  getHtmlLang,
  getStoredAppLanguage,
  getTextDirection,
  normalizeAppLanguage,
  setStoredAppLanguage,
  SUPPORTED_APP_LANGUAGES,
} from "@/lib/locale";

// Default language is ALWAYS English so first render is deterministic
// (SSR + client) and never mixes Arabic with English. Arabic is opt-in
// via the LanguageSwitcher which persists the choice in localStorage.
function initialLanguage(): "en" | "ar" {
  return getStoredAppLanguage();
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: "en", // deterministic first render — client hydration matches server
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_APP_LANGUAGES],
    interpolation: { escapeValue: false },
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
  setStoredAppLanguage(language);
}
