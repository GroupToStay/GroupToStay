import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: i18n.t("admin.settings.metaTitle") }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Settings className="h-7 w-7" /> {t("admin.settings.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.settings.description")}</p>
      </header>

      <Card>
        <CardContent className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-medium text-primary">
              <ShieldCheck className="h-4 w-4" /> {t("admin.settings.profile.title")}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("admin.settings.profile.description")}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard/profile">{t("admin.settings.profile.action")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
