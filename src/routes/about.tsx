import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicPageHero, PublicPageLayout } from "@/components/public-page";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: i18n.t("about.metaTitle") },
      {
        name: "description",
        content: i18n.t("about.metaDescription"),
      },
      { property: "og:title", content: i18n.t("about.metaTitle") },
      {
        property: "og:description",
        content: i18n.t("about.ogDescription"),
      },
      { property: "og:url", content: "https://groupstay-connect.lovable.app/about" },
    ],
    links: [{ rel: "canonical", href: "https://groupstay-connect.lovable.app/about" }],
  }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return (
    <PublicPageLayout>
      <PublicPageHero title={t("about.title")} description={t("about.metaDescription")} />
      <section className="container-page py-12 md:py-16">
        <p className="max-w-3xl text-lg leading-8 text-foreground/80">{t("about.body")}</p>
      </section>
    </PublicPageLayout>
  );
}
