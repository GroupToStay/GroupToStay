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

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — GroupToStay" }, { name: "description", content: "Get in touch with the GroupToStay team." }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => { toast.success(t("contact.sent")); (e.target as HTMLFormElement).reset(); setSending(false); }, 600);
  };
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container-page py-16 flex-1 max-w-xl">
        <h1 className="font-display text-4xl text-primary">{t("contact.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("contact.subtitle")}</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div><Label>{t("contact.name")}</Label><Input required maxLength={120} /></div>
          <div><Label>{t("contact.email")}</Label><Input type="email" required maxLength={200} /></div>
          <div><Label>{t("contact.message")}</Label><Textarea required maxLength={2000} rows={5} /></div>
          <Button type="submit" variant="gold" disabled={sending}>{t("contact.send")}</Button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
