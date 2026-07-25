import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PublicPageHero, PublicPageLayout } from "@/components/public-page";
import { useApplicationLocale } from "@/lib/application-locale";
import i18n from "@/lib/i18n";

const LEGAL_EMAIL = "legal@grouptostay.com";
const TERM_SECTIONS = ["acceptance", "service", "verification", "quotations", "fees"] as const;
const FINAL_TERM_SECTIONS = ["liability", "law"] as const;

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: i18n.t("legal.terms.metaTitle") },
      { name: "description", content: i18n.t("legal.terms.metaDescription") },
    ],
  }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { formatDate } = useApplicationLocale();
  const prohibitedItems = t("legal.terms.sections.prohibited.items", {
    returnObjects: true,
  }) as string[];

  return (
    <PublicPageLayout>
      <PublicPageHero
        compact
        title={t("legal.terms.title")}
        description={t("legal.terms.metaDescription")}
      />
      <article className="container-page max-w-3xl py-10 md:py-14">
        <p className="text-sm text-muted-foreground">
          {t("legal.lastUpdated", {
            date: formatDate(new Date(), { year: "numeric", month: "long", day: "numeric" }),
          })}
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-7 text-foreground/85 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground">
          {TERM_SECTIONS.map((section) => (
            <section key={section}>
              <h2 className="font-display text-2xl text-primary">
                {t(`legal.terms.sections.${section}.title`)}
              </h2>
              <p>{t(`legal.terms.sections.${section}.body`)}</p>
            </section>
          ))}

          <section>
            <h2 className="font-display text-2xl text-primary">
              {t("legal.terms.sections.prohibited.title")}
            </h2>
            <ul className="list-disc ps-5 space-y-2">
              {prohibitedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {FINAL_TERM_SECTIONS.map((section) => (
            <section key={section}>
              <h2 className="font-display text-2xl text-primary">
                {t(`legal.terms.sections.${section}.title`)}
              </h2>
              <p>{t(`legal.terms.sections.${section}.body`)}</p>
            </section>
          ))}

          <section>
            <h2 className="font-display text-2xl text-primary">
              {t("legal.terms.sections.contact.title")}
            </h2>
            <p>{LEGAL_EMAIL}</p>
          </section>
        </div>
      </article>
    </PublicPageLayout>
  );
}
