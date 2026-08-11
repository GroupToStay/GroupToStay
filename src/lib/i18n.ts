import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  getHtmlLang,
  getTextDirection,
  normalizeAppLanguage,
  setStoredAppLanguage,
  SUPPORTED_APP_LANGUAGES,
} from "@/lib/locale";
import { applyNoTranslateAttributes } from "@/lib/translation-hardening";
import arAdmin from "@/locales/ar/admin.json";
import arAuth from "@/locales/ar/auth.json";
import arButtons from "@/locales/ar/buttons.json";
import arCommon from "@/locales/ar/common.json";
import arCompany from "@/locales/ar/company.json";
import arDashboard from "@/locales/ar/dashboard.json";
import arDeals from "@/locales/ar/deals.json";
import arErrors from "@/locales/ar/errors.json";
import arForms from "@/locales/ar/forms.json";
import arHotel from "@/locales/ar/hotel.json";
import arLanding from "@/locales/ar/landing.json";
import arLegacy from "@/locales/ar/legacy.json";
import arLegal from "@/locales/ar/legal.json";
import arNavigation from "@/locales/ar/navigation.json";
import arNotifications from "@/locales/ar/notifications.json";
import arPricing from "@/locales/ar/pricing.json";
import arProfile from "@/locales/ar/profile.json";
import arRfq from "@/locales/ar/rfq.json";
import arSubscriptions from "@/locales/ar/subscriptions.json";
import arValidation from "@/locales/ar/validation.json";
import enAdmin from "@/locales/en/admin.json";
import enAuth from "@/locales/en/auth.json";
import enButtons from "@/locales/en/buttons.json";
import enCommon from "@/locales/en/common.json";
import enCompany from "@/locales/en/company.json";
import enDashboard from "@/locales/en/dashboard.json";
import enDeals from "@/locales/en/deals.json";
import enErrors from "@/locales/en/errors.json";
import enForms from "@/locales/en/forms.json";
import enHotel from "@/locales/en/hotel.json";
import enLanding from "@/locales/en/landing.json";
import enLegacy from "@/locales/en/legacy.json";
import enLegal from "@/locales/en/legal.json";
import enNavigation from "@/locales/en/navigation.json";
import enNotifications from "@/locales/en/notifications.json";
import enPricing from "@/locales/en/pricing.json";
import enProfile from "@/locales/en/profile.json";
import enRfq from "@/locales/en/rfq.json";
import enSubscriptions from "@/locales/en/subscriptions.json";
import enValidation from "@/locales/en/validation.json";

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
  "deals",
] as const;

const localeModules = {
  ar: [
    arCommon,
    arNavigation,
    arLanding,
    arAuth,
    arAdmin,
    arDashboard,
    arHotel,
    arRfq,
    arForms,
    arValidation,
    arErrors,
    arNotifications,
    arLegal,
    arProfile,
    arPricing,
    arCompany,
    arSubscriptions,
    arButtons,
    arLegacy,
    arDeals,
  ],
  en: [
    enCommon,
    enNavigation,
    enLanding,
    enAuth,
    enAdmin,
    enDashboard,
    enHotel,
    enRfq,
    enForms,
    enValidation,
    enErrors,
    enNotifications,
    enLegal,
    enProfile,
    enPricing,
    enCompany,
    enSubscriptions,
    enButtons,
    enLegacy,
    enDeals,
  ],
} satisfies Record<string, TranslationResource[]>;

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

  Object.entries(localeModules).forEach(([language, modules]) => {
    resources[language] = {
      translation: modules.reduce<TranslationResource>(
        (merged, resource) => deepMerge(merged, resource),
        {},
      ),
    };
  });

  return resources;
}

// The router applies the request cookie before rendering. English remains
// the fallback for first visits and unsupported locale values.
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
