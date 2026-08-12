"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicPageHero, PublicPageLayout } from "@/components/public-page";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/for-hotels")({
  head: () => ({
    meta: [
      { title: i18n.t("forHotels.metaTitle") },
      {
        name: "description",
        content: i18n.t("forHotels.metaDescription"),
      },
      { property: "og:title", content: i18n.t("forHotels.metaOgTitle") },
      {
        property: "og:description",
        content: i18n.t("forHotels.metaOgDescription"),
      },
      { property: "og:url", content: "https://group-to-stay.vercel.app/for-hotels" },
    ],
    links: [{ rel: "canonical", href: "https://group-to-stay.vercel.app/for-hotels" }],
  }),
  component: Page,
});

export function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isHotel, isAdmin, isOrganizer } = useRoles();
  // Show hotel signup / list-your-hotel CTAs only to public visitors and hotel users.
  const showHotelCta = !user || (isHotel && !isAdmin && !isOrganizer);

  return (
    <PublicPageLayout>
      <PublicPageHero
        dark
        title={t("forHotels.title")}
        description={t("forHotels.subtitle")}
        actions={
          showHotelCta ? (
            <Button asChild variant="hero" size="lg">
              <Link to={user ? "/dashboard/hotel" : "/auth"}>{t("forHotels.ctaList")}</Link>
            </Button>
          ) : undefined
        }
      />
      <section className="container-page py-12 md:py-16">
        <div className="grid border-y border-border md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <article
              key={n}
              className="border-b border-border p-6 last:border-b-0 md:border-b-0 md:border-e md:last:border-e-0 md:p-8"
            >
              <CheckCircle2 className="h-6 w-6 text-success" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">
                {t(`forHotels.benefit${n}Title`)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(`forHotels.benefit${n}Body`)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </PublicPageLayout>
  );
}
