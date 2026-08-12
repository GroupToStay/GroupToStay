"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PublicPageHero, PublicPageLayout } from "@/components/public-page";
import { useApplicationLocale } from "@/lib/application-locale";
import i18n from "@/lib/i18n";

const PRIVACY_EMAIL = "privacy@grouptostay.com";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: i18n.t("legal.privacy.metaTitle") },
      { name: "description", content: i18n.t("legal.privacy.metaDescription") },
    ],
  }),
  component: Page,
});

export function Page() {
  const { t } = useTranslation();
  const { formatDate } = useApplicationLocale();
  const informationItems = t("legal.privacy.sections.information.items", {
    returnObjects: true,
  }) as string[];
  const usageItems = t("legal.privacy.sections.usage.items", { returnObjects: true }) as string[];

  return (
    <PublicPageLayout>
      <PublicPageHero
        compact
        title={t("legal.privacy.title")}
        description={t("legal.privacy.sections.introduction.body")}
      />
      <article className="container-page max-w-3xl py-10 md:py-14">
        <p className="text-sm text-muted-foreground">
          {t("legal.lastUpdated", {
            date: formatDate(new Date(), { year: "numeric", month: "long", day: "numeric" }),
          })}
        </p>

        <section className="mt-8 space-y-8 text-[15px] leading-7 text-foreground/85 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground">
          <h2 className="font-display text-2xl text-primary">
            {t("legal.privacy.sections.introduction.title")}
          </h2>
          <p>{t("legal.privacy.sections.introduction.body")}</p>

          <h2 className="font-display text-2xl text-primary">
            {t("legal.privacy.sections.information.title")}
          </h2>
          <ul className="list-disc ps-5 space-y-2">
            {informationItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2 className="font-display text-2xl text-primary">
            {t("legal.privacy.sections.usage.title")}
          </h2>
          <ul className="list-disc ps-5 space-y-2">
            {usageItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2 className="font-display text-2xl text-primary">
            {t("legal.privacy.sections.sharing.title")}
          </h2>
          <p>{t("legal.privacy.sections.sharing.body")}</p>

          <h2 className="font-display text-2xl text-primary">
            {t("legal.privacy.sections.retention.title")}
          </h2>
          <p>{t("legal.privacy.sections.retention.body")}</p>

          <h2 className="font-display text-2xl text-primary">
            {t("legal.privacy.sections.rights.title")}
          </h2>
          <p>
            {t("legal.privacy.sections.rights.body")}{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary underline">
              {PRIVACY_EMAIL}
            </a>
            .
          </p>

          <h2 className="font-display text-2xl text-primary">
            {t("legal.privacy.sections.security.title")}
          </h2>
          <p>
            {t("legal.privacy.sections.security.bodyBefore")}{" "}
            <Link to="/trust" className="text-primary underline">
              {t("legal.privacy.sections.security.link")}
            </Link>{" "}
            {t("legal.privacy.sections.security.bodyAfter")}
          </p>

          <h2 className="font-display text-2xl text-primary">
            {t("legal.privacy.sections.contact.title")}
          </h2>
          <p>
            {t("legal.privacy.sections.contact.body")}{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary underline">
              {PRIVACY_EMAIL}
            </a>
            .
          </p>
        </section>
      </article>
    </PublicPageLayout>
  );
}
