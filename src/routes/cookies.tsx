"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PublicPageHero, PublicPageLayout } from "@/components/public-page";
import { useApplicationLocale } from "@/lib/application-locale";
import i18n from "@/lib/i18n";

const PRIVACY_EMAIL = "privacy@grouptostay.com";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: i18n.t("legal.cookies.metaTitle") },
      { name: "description", content: i18n.t("legal.cookies.metaDescription") },
    ],
  }),
  component: Page,
});

export function Page() {
  const { t } = useTranslation();
  const { formatDate } = useApplicationLocale();
  const necessaryItems = t("legal.cookies.sections.necessary.items", {
    returnObjects: true,
  }) as string[];

  return (
    <PublicPageLayout>
      <PublicPageHero
        compact
        title={t("legal.cookies.title")}
        description={t("legal.cookies.intro")}
      />
      <article className="container-page max-w-3xl py-10 md:py-14">
        <p className="text-sm text-muted-foreground">
          {t("legal.lastUpdated", {
            date: formatDate(new Date(), { year: "numeric", month: "long", day: "numeric" }),
          })}
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-7 text-foreground/85 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground">
          <p>{t("legal.cookies.intro")}</p>

          <h2 className="font-display text-2xl text-primary">
            {t("legal.cookies.sections.necessary.title")}
          </h2>
          <ul className="list-disc ps-5 space-y-2">
            {necessaryItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          {(["preferences", "analytics", "management"] as const).map((section) => (
            <section key={section}>
              <h2 className="font-display text-2xl text-primary">
                {t(`legal.cookies.sections.${section}.title`)}
              </h2>
              <p>{t(`legal.cookies.sections.${section}.body`)}</p>
            </section>
          ))}

          <h2 className="font-display text-2xl text-primary">
            {t("legal.cookies.sections.contact.title")}
          </h2>
          <p>
            <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary underline">
              {PRIVACY_EMAIL}
            </a>
          </p>
        </div>
      </article>
    </PublicPageLayout>
  );
}
