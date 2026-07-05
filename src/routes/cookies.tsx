import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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

function Page() {
  const { t } = useTranslation();
  const { formatDate } = useApplicationLocale();
  const necessaryItems = t("legal.cookies.sections.necessary.items", {
    returnObjects: true,
  }) as string[];

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1 container-page py-12 max-w-3xl">
        <h1 className="font-display text-4xl text-primary">{t("legal.cookies.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("legal.lastUpdated", {
            date: formatDate(new Date(), { year: "numeric", month: "long", day: "numeric" }),
          })}
        </p>

        <div className="mt-6 space-y-4 text-foreground/90">
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
      </main>
      <SiteFooter />
    </div>
  );
}
