import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server } from "lucide-react";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/hotel/pms")({
  head: () => ({ meta: [{ title: i18n.t("hotelDash.pms.metaTitle") }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Server className="h-7 w-7" /> {t("hotelDash.pms.title")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("hotelDash.pms.description")}</p>
      </div>
      <Card>
        <CardContent className="p-6 space-y-3">
          <Badge className="bg-muted text-muted-foreground">
            {t("hotelDash.pms.notConnected")}
          </Badge>
          <p className="text-sm text-muted-foreground">{t("hotelDash.pms.futureAvailability")}</p>
          <p className="text-xs text-muted-foreground">{t("hotelDash.pms.profileHint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
