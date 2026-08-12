"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicPageHero, PublicPageLayout } from "@/components/public-page";
import { CheckCircle2 } from "lucide-react";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: i18n.t("how.metaTitle") },
      {
        name: "description",
        content: i18n.t("how.metaDescription"),
      },
      { property: "og:title", content: i18n.t("how.metaTitle") },
      {
        property: "og:description",
        content: i18n.t("how.metaOgDescription"),
      },
      { property: "og:url", content: "https://group-to-stay.vercel.app/how-it-works" },
    ],
    links: [{ rel: "canonical", href: "https://group-to-stay.vercel.app/how-it-works" }],
  }),
  component: Page,
});

export function Page() {
  const { t } = useTranslation();
  return (
    <PublicPageLayout>
      <PublicPageHero title={t("how.title")} description={t("how.subtitle")} />
      <section className="container-page py-12 md:py-16">
        <div className="grid border-y border-border md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <article
              key={n}
              className="border-b border-border p-6 last:border-b-0 md:border-b-0 md:border-e md:last:border-e-0 md:p-8"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-primary text-sm font-semibold text-gold">
                  {n}
                </span>
                <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-foreground">
                {t(`how.step${n}Title`)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(`how.step${n}Body`)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </PublicPageLayout>
  );
}
