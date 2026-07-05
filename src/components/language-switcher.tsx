import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useApplicationLocale } from "@/lib/application-locale";

export function LanguageSwitcher() {
  const { language, setLanguage } = useApplicationLocale();
  const { t } = useTranslation();

  const toggle = () => {
    void setLanguage(language === "ar" ? "en" : "ar");
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="gap-2">
      <Languages className="h-4 w-4" />
      {language === "ar"
        ? t("common.languageNames.englishShort")
        : t("common.languageNames.arabicShort")}
    </Button>
  );
}
