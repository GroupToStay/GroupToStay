import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — GroupToStay" },
      { name: "description", content: "From RFQ to confirmed group booking in three steps." },
    ],
  }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container-page py-16 flex-1">
        <h1 className="font-display text-4xl md:text-5xl text-primary">{t("how.title")}</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">{t("how.subtitle")}</p>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <Card key={n}><CardContent className="p-6">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-gold font-display text-lg">{n}</div>
              <h3 className="mt-4 font-display text-xl text-primary">{t(`how.step${n}Title`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`how.step${n}Body`)}</p>
            </CardContent></Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
