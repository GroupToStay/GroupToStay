import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export function AccessDenied({ title, message }: { title?: string; message?: string }) {
  const { t } = useTranslation();
  const displayTitle = title ?? t("errors.accessDenied.title");
  const displayMessage = message ?? t("errors.accessDenied.hotelDirectoryMessage");

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center">
        <div className="container-page py-24 max-w-xl text-center">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl text-primary">403 - {displayTitle}</h1>
          <p className="mt-3 text-muted-foreground">{displayMessage}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link to="/">{t("errors.accessDenied.returnHome")}</Link>
            </Button>
            <Button asChild variant="gold">
              <Link to="/request-quote">{t("errors.accessDenied.createRequest")}</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
