import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container-page py-16 flex-1 max-w-xl">
        <h1 className="font-display text-4xl text-primary">{t("contact.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("contact.subtitle")}</p>
        <form method="post" onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="contact-name">{t("contact.name")}</Label>
            <Input id="contact-name" required maxLength={120} />
          </div>
          <div>
            <Label htmlFor="contact-email">{t("contact.email")}</Label>
            <Input id="contact-email" type="email" required maxLength={200} />
          </div>
          <div>
            <Label htmlFor="contact-message">{t("contact.message")}</Label>
            <Textarea id="contact-message" required maxLength={2000} rows={5} />
          </div>
          <Button type="submit" variant="gold" disabled={sending}>
            {t("contact.send")}
          </Button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
