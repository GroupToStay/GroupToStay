import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { PublicPageHero, PublicPageLayout } from "@/components/public-page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: i18n.t("contact.metaTitle") },
      { name: "description", content: i18n.t("contact.metaDescription") },
    ],
  }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      toast.success(t("contact.sent"));
      (e.target as HTMLFormElement).reset();
      setSending(false);
    }, 600);
  };
  return (
    <PublicPageLayout>
      <PublicPageHero title={t("contact.title")} description={t("contact.subtitle")} />
      <section className="container-page py-12 md:py-16">
        <Card className="mx-auto max-w-xl">
          <CardContent className="p-6 md:p-8">
            <form method="post" onSubmit={onSubmit} className="space-y-5">
              <div>
                <Label htmlFor="contact-name">{t("contact.name")}</Label>
                <Input id="contact-name" required maxLength={120} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="contact-email">{t("contact.email")}</Label>
                <Input
                  id="contact-email"
                  type="email"
                  required
                  maxLength={200}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="contact-message">{t("contact.message")}</Label>
                <Textarea
                  id="contact-message"
                  required
                  maxLength={2000}
                  rows={6}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={sending}>
                {t("contact.send")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </PublicPageLayout>
  );
}
