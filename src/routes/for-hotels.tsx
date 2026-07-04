import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/for-hotels")({
  head: () => ({
    meta: [
      { title: "For hotels — GroupToStay" },
      {
        name: "description",
        content: "List your hotel and receive pre-qualified Group Requests. Pay only when you win.",
      },
      { property: "og:title", content: "Win more group business with GroupToStay" },
    ],
  }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isHotel, isAdmin, isOrganizer } = useRoles();
  // Show hotel signup / list-your-hotel CTAs only to public visitors and hotel users.
  const showHotelCta = !user || (isHotel && !isAdmin && !isOrganizer);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground">
          <div className="container-page py-20">
            <h1 className="font-display text-4xl md:text-5xl">{t("forHotels.title")}</h1>
            <p className="mt-3 text-primary-foreground/80 max-w-2xl">{t("forHotels.subtitle")}</p>
            {showHotelCta && (
              <Button asChild variant="hero" size="lg" className="mt-6">
                <Link to={user ? "/dashboard/hotel" : "/auth"}>{t("forHotels.ctaList")}</Link>
              </Button>
            )}
          </div>
        </section>
        <section className="container-page py-16 grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <Card key={n}>
              <CardContent className="p-6">
                <CheckCircle2 className="h-6 w-6 text-gold" />
                <h3 className="mt-3 font-display text-xl text-primary">
                  {t(`forHotels.benefit${n}Title`)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`forHotels.benefit${n}Body`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
