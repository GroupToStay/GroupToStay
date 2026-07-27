import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicPageHero, PublicPageLayout } from "@/components/public-page";
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
    <section className="rounded-lg border border-border bg-card p-6 md:p-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/5 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold text-foreground md:text-xl">{title}</h2>
      </div>
      <div className="space-y-3 text-[15px] leading-7 text-foreground/80">{children}</div>
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
    <PublicPageLayout>
      <PublicPageHero dark title={t("legal.trust.title")} description={t("legal.trust.intro")} />
      <div className="container-page grid gap-5 py-12 md:grid-cols-2 md:py-16">
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
    </PublicPageLayout>
  );
}
