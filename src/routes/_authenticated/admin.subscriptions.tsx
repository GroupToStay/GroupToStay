import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  head: () => ({ meta: [{ title: i18n.t("admin.subscriptions.metaTitle") }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <CreditCard className="h-7 w-7" /> {t("admin.subscriptions.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.subscriptions.description")}</p>
      </header>
      <Card>
        <CardContent className="p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-2xl text-primary">
            {t("admin.subscriptions.empty.title")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {t("admin.subscriptions.empty.description")}
          </p>
          <Badge className="mt-4 bg-muted text-muted-foreground uppercase tracking-wide">
            {t("admin.subscriptions.empty.status")}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
