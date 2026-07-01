import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import ar from "@/locales/ar.json";

// Default language is ALWAYS English so first render is deterministic
// (SSR + client) and never mixes Arabic with English. Arabic is opt-in
// via the LanguageSwitcher which persists the choice in localStorage.
const STORAGE_KEY = "gts_lang";

function initialLanguage(): "en" | "ar" {
  // Server render: always English.
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") return saved;
  } catch {}
  return "en";
}

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: { en: { translation: en }, ar: { translation: ar } },
      lng: "en", // deterministic first render — client hydration matches server
      fallbackLng: "en",
      supportedLngs: ["en", "ar"],
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
  const dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  try { window.localStorage.setItem(STORAGE_KEY, lang); } catch {}
}
