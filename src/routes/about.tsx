import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — GroupToStay" }, { name: "description", content: "The B2B marketplace built exclusively for group accommodation." }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container-page py-20 flex-1 max-w-3xl">
        <h1 className="font-display text-4xl md:text-5xl text-primary">{t("about.title")}</h1>
        <p className="mt-6 text-lg text-foreground/80 leading-relaxed">{t("about.body")}</p>
      </main>
      <SiteFooter />
    </div>
  );
}
