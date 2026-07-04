import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { applyLocale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  useEffect(() => {
    applyLocale(i18n.language);
  }, [i18n.language]);

  const toggle = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
    applyLocale(next);
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="gap-2">
      <Languages className="h-4 w-4" />
      {i18n.language === "ar" ? "EN" : "عربي"}
    </Button>
  );
}
