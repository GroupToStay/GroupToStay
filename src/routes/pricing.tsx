"use client";

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicPageHero, PublicPageLayout } from "@/components/public-page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: i18n.t("pricing.meta.title") },
      {
        name: "description",
        content: i18n.t("pricing.meta.description"),
      },
      { property: "og:title", content: i18n.t("pricing.meta.title") },
      {
        property: "og:description",
        content: i18n.t("pricing.meta.ogDescription"),
      },
      { property: "og:url", content: "https://group-to-stay.vercel.app/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://group-to-stay.vercel.app/pricing" }],
  }),
  component: Page,
});

type Plan = {
  key: "organizer" | "hotelBasic" | "hotelPro" | "hotelPremium" | "enterprise";
  featured?: boolean;
  cta: string;
  itemsKey: string;
  audience: "organizer" | "hotel";
};

export function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isOrganizer, isHotel, isAdmin, loading } = useRoles();
  const navigate = useNavigate();

  const { data: hotelCount = 0 } = useQuery({
    queryKey: ["my-hotel-count", user?.id],
    enabled: !!user && isHotel,
    queryFn: async () => {
      const { count } = await supabase
        .from("hotels")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user!.id);
      return count ?? 0;
    },
  });

  // Organizers don't need pricing — redirect to their dashboard.
  useEffect(() => {
    if (!loading && user && isOrganizer) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, isOrganizer, navigate]);

  const plans: Plan[] = [
    {
      key: "organizer",
      cta: "/request-quote",
      audience: "organizer",
      itemsKey: "pricing.features.organizer",
    },
    {
      key: "hotelBasic",
      cta: "/for-hotels",
      audience: "hotel",
      itemsKey: "pricing.features.hotelBasic",
    },
    {
      key: "hotelPro",
      featured: true,
      cta: "/for-hotels",
      audience: "hotel",
      itemsKey: "pricing.features.hotelPro",
    },
    {
      key: "hotelPremium",
      cta: "/for-hotels",
      audience: "hotel",
      itemsKey: "pricing.features.hotelPremium",
    },
    {
      key: "enterprise",
      cta: "/contact",
      audience: "hotel",
      itemsKey: "pricing.features.enterprise",
    },
  ];

  // Admins see all plans for reference, but no upgrade CTAs.
  const hideUpgradeCtas = isAdmin;

  return (
    <PublicPageLayout>
      <PublicPageHero title={t("pricing.title")} description={t("pricing.subtitle")} />
      <section className="container-page py-12 md:py-16">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {plans
            // Hotel users never see the organizer plan
            .filter((p) => !(isHotel && p.audience === "organizer"))
            // Hotel users with an existing hotel don't see the Free Listing plan
            .filter((p) => !(isHotel && hotelCount > 0 && p.key === "hotelBasic"))
            .map((p) => {
              const price = t(`pricing.${p.key}Price`);
              const showMonthly = p.key === "hotelPro" || p.key === "hotelPremium";
              const isPaidHotelPlan = p.key === "hotelPro" || p.key === "hotelPremium";
              const items = t(p.itemsKey, { returnObjects: true }) as string[];
              return (
                <Card
                  key={p.key}
                  className={p.featured ? "border-gold shadow-[var(--shadow-gold)]" : ""}
                >
                  <CardContent className="flex h-full flex-col p-6">
                    <div className="text-sm font-medium text-muted-foreground">
                      {t(`pricing.${p.key}`)}
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-primary tabular-nums">
                      {price}
                      {showMonthly && (
                        <span className="text-base text-muted-foreground">
                          {" "}
                          {t("pricing.perMonth")}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t(`pricing.${p.key}Desc`)}
                    </p>
                    <ul className="mt-5 flex-1 space-y-3 text-sm">
                      {items.map((i) => (
                        <li key={i} className="flex gap-2">
                          <Check className="h-4 w-4 text-success mt-0.5 shrink-0" /> {i}
                        </li>
                      ))}
                    </ul>
                    {!hideUpgradeCtas &&
                      (isPaidHotelPlan ? (
                        <Button asChild className="mt-6" variant={p.featured ? "gold" : "default"}>
                          <Link
                            to="/subscription/coming-soon"
                            search={{ plan: p.key === "hotelPro" ? "professional" : "featured" }}
                          >
                            {t("pricing.comingSoon")}
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild className="mt-6" variant={p.featured ? "gold" : "default"}>
                          <Link to={p.cta}>{t(`pricing.${p.key}Cta`)}</Link>
                        </Button>
                      ))}
                  </CardContent>
                </Card>
              );
            })}
        </div>
        {isHotel && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t("pricing.manageFromDashboard")}
          </p>
        )}
      </section>
    </PublicPageLayout>
  );
}
