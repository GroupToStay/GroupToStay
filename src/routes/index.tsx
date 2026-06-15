import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2, Users, Globe2, Clock, Percent, ShieldCheck, Star, MessageSquare, Inbox } from "lucide-react";
import heroImg from "@/assets/hero-lobby.jpg";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GroupToStay — Group accommodation marketplace" },
      { name: "description", content: "Submit one RFQ, receive competing hotel quotations. The B2B platform for group hotel sourcing — Umrah, Hajj, tourism, corporate, sports and events." },
      { property: "og:title", content: "GroupToStay — Group accommodation marketplace" },
      { property: "og:description", content: "One request. Multiple hotels. The best group rate." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isHotel } = useRoles();
  const { data: featured } = useQuery({
    queryKey: ["featured-hotels"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hotels")
        .select("id,slug,name,city,country,star_rating,cover_image,description")
        .eq("status", "approved")
        .eq("featured", true)
        .limit(3);
      return data ?? [];
    },
  });

  const audiences = [
    { key: "umrah", icon: Building2 }, { key: "hajj", icon: Building2 },
    { key: "tourism", icon: Globe2 }, { key: "corporate", icon: Users },
    { key: "government", icon: ShieldCheck }, { key: "sports", icon: Users },
    { key: "education", icon: Users }, { key: "event", icon: Globe2 },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <img src={heroImg} alt="" width={1920} height={1280} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 hero-gradient" />
        <div className="relative container-page py-24 md:py-36 text-primary-foreground">
          <Badge className="bg-gold text-gold-foreground border-0 mb-5 uppercase tracking-wider">{t("hero.eyebrow")}</Badge>
          <h1 className="font-display text-4xl md:text-6xl font-semibold max-w-3xl leading-tight">
            {t("hero.title")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-primary-foreground/85">{t("hero.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/request-quote">{t("hero.ctaPrimary")} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/hotels">{t("hero.ctaSecondary")}</Link>
            </Button>
          </div>
          <p className="mt-10 text-sm text-primary-foreground/60">{t("hero.trust")}</p>
        </div>
      </section>

      {/* STATS strip */}
      <section className="border-y border-border bg-surface">
        <div className="container-page py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { k: "50k+", l: t("stats.rooms") },
            { k: "120+", l: t("stats.destinations") },
            { k: "<4h", l: t("stats.responseTime") },
            { k: "18%", l: t("stats.save") },
          ].map((s) => (
            <div key={s.l}>
              <div className="font-display text-3xl md:text-4xl text-primary">{s.k}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container-page py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl text-primary">{t("how.title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("how.subtitle")}</p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="border-border">
              <CardContent className="p-6">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-gold font-display text-lg">{n}</div>
                <h3 className="mt-4 font-display text-xl text-primary">{t(`how.step${n}Title`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`how.step${n}Body`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* AUDIENCES */}
      <section className="bg-surface border-y border-border">
        <div className="container-page py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl text-primary">{t("audiences.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("audiences.subtitle")}</p>
          </div>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            {audiences.map(({ key, icon: Icon }) => (
              <div key={key} className="bg-background rounded-lg border border-border p-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/5 text-primary"><Icon className="h-5 w-5" /></span>
                <span className="font-medium text-foreground">{t(`audiences.list.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED HOTELS */}
      {featured && featured.length > 0 && (
        <section className="container-page py-20">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-3xl md:text-4xl text-primary">{t("featured.title")}</h2>
              <p className="mt-2 text-muted-foreground">{t("featured.subtitle")}</p>
            </div>
            <Button asChild variant="ghost"><Link to="/hotels">{t("featured.viewAll")} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link></Button>
          </div>
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {featured.map((h) => (
              <Link key={h.id} to="/hotels/$id" params={{ id: h.id }} className="group rounded-lg overflow-hidden border border-border bg-card hover:shadow-[var(--shadow-elevated)] transition">
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {h.cover_image && <img loading="lazy" src={h.cover_image} alt={h.name} className="h-full w-full object-cover group-hover:scale-105 transition" />}
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-1 text-gold">
                    {Array.from({ length: h.star_rating ?? 0 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                  </div>
                  <h3 className="font-display text-lg mt-2 text-primary">{h.name}</h3>
                  <div className="text-sm text-muted-foreground">{h.city}, {h.country}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA banner */}
      <section className="container-page py-16">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-10 md:p-14 text-primary-foreground">
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative grid md:grid-cols-[1fr_auto] items-center gap-6">
            <div>
              <h3 className="font-display text-3xl">{t("hero.ctaPrimary")}</h3>
              <p className="mt-2 text-primary-foreground/80 max-w-xl">{t("hero.subtitle")}</p>
            </div>
            <Button asChild variant="hero" size="lg"><Link to="/request-quote">{t("hero.ctaPrimary")}</Link></Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
