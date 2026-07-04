import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApplicationLocale } from "@/lib/application-locale";

export function LanguageSwitcher() {
  const { language, setLanguage } = useApplicationLocale();

  const toggle = () => {
    void setLanguage(language === "ar" ? "en" : "ar");
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="gap-2">
      <Languages className="h-4 w-4" />
      {language === "ar" ? "EN" : "\u0639\u0631\u0628\u064a"}
    </Button>
  );
}
