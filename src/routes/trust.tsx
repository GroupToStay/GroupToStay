import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Shield, Lock, Database, UserCheck, Cookie, Mail, FileText, Server } from "lucide-react";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: i18n.t("legal.trust.metaTitle") },
      {
        name: "description",
        content: i18n.t("legal.trust.metaDescription"),
      },
      { property: "og:title", content: i18n.t("legal.trust.metaTitle") },
      {
        property: "og:description",
        content: i18n.t("legal.trust.metaOgDescription"),
      },
    ],
  }),
  component: TrustPage,
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Shield;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border rounded-2xl p-6 md:p-8 bg-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-xl md:text-2xl text-primary">{title}</h2>
      </div>
      <div className="text-foreground/80 leading-relaxed space-y-3 text-[15px]">{children}</div>
    </section>
  );
}

function TrustPage() {
  const { t } = useTranslation();
  const sections = [
    { key: "authentication", icon: UserCheck },
    { key: "hosting", icon: Server },
    { key: "data", icon: Database },
    { key: "sharing", icon: Lock },
    { key: "cookies", icon: Cookie },
    { key: "retention", icon: FileText },
    { key: "responsibility", icon: Shield },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground">
          <div className="container-page py-14">
            <div className="flex items-center gap-3">
              <Shield className="h-7 w-7" />
              <h1 className="font-display text-4xl md:text-5xl">{t("legal.trust.title")}</h1>
            </div>
            <p className="mt-4 max-w-2xl text-primary-foreground/85 leading-relaxed">
              {t("legal.trust.intro")}
            </p>
          </div>
        </section>

        <div className="container-page py-12 grid gap-6 md:grid-cols-2">
          {sections.map(({ key, icon }) => {
            const body = t(`legal.trust.sections.${key}.body`, { returnObjects: true }) as string[];
            return (
              <Section key={key} icon={icon} title={t(`legal.trust.sections.${key}.title`)}>
                {body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </Section>
            );
          })}

          <Section icon={Mail} title={t("legal.trust.sections.contact.title")}>
            <p>
              {t("legal.trust.sections.contact.bodyBefore")}{" "}
              <Link to="/contact" className="text-primary underline">
                {t("legal.contactPage")}
              </Link>
              {t("legal.trust.sections.contact.bodyAfter")}
            </p>
          </Section>
        </div>

        <div className="container-page pb-16">
          <p className="text-sm text-muted-foreground">{t("legal.trust.footer")}</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
