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
      { name: "description", content: "Submit one Group Request, receive competing hotel quotations. The B2B platform for group hotel sourcing — Umrah, Hajj, tourism, corporate, sports and events." },
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
            {isHotel ? (
              <>
                <Button asChild variant="hero" size="lg">
                  <Link to="/requests">{t("hero.ctaBrowseRequests")} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  <Link to="/dashboard/hotel">{t("nav.hotelProfile")}</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="hero" size="lg">
                  <Link to="/request-quote">{t("hero.ctaPrimary")} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  <Link to="/hotels">{t("hero.ctaSecondary")}</Link>
                </Button>
              </>
            )}
          </div>
          <p className="mt-10 text-sm text-primary-foreground/60">{t("hero.trust")}</p>
        </div>
      </section>

      {/* STATS strip */}
      {isHotel && user ? (
        <HotelStatsStrip userId={user.id} />
      ) : (
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
      )}

      {/* MESSAGES — bridge between hotels and organizers */}
      {user ? (
        <MessagesBar userId={user.id} />
      ) : (
        <section className="container-page py-20">
          <div className="rounded-2xl border border-border bg-card p-8 md:p-12 grid md:grid-cols-[auto_1fr_auto] items-center gap-6">
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-primary text-gold">
              <MessageSquare className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-display text-2xl md:text-3xl text-primary">{t("home.messages.title")}</h2>
              <p className="mt-2 text-muted-foreground max-w-2xl">{t("home.messages.subtitle")}</p>
            </div>
            <Button asChild variant="gold" size="lg"><Link to="/auth">{t("nav.signIn")} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link></Button>
          </div>
        </section>
      )}


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

      {/* OPEN REQUESTS (public) */}
      <OpenRequestsSection />



      {/* CTA banner */}
      {!isHotel ? (
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
      ) : (
        <section className="container-page py-16">
          <div className="relative overflow-hidden rounded-2xl bg-primary p-10 md:p-14 text-primary-foreground">
            <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold/20 blur-3xl" />
            <div className="relative grid md:grid-cols-[1fr_auto] items-center gap-6">
              <div>
                <h3 className="font-display text-3xl">{t("hero.ctaBrowseRequests")}</h3>
                <p className="mt-2 text-primary-foreground/80 max-w-xl">{t("hero.hotelCtaSubtitle")}</p>
              </div>
              <Button asChild variant="hero" size="lg"><Link to="/requests">{t("hero.ctaBrowseRequests")}</Link></Button>
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}

function MessagesBar({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: messages = [] } = useQuery({
    queryKey: ["home-messages", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, body, created_at, sender_id, recipient_id, rfq_id, rfqs(id, group_name)")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <section className="container-page py-12">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/5 text-primary">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-xl text-primary">{t("home.messages.title")}</h3>
              <p className="text-sm text-muted-foreground">{t("home.messages.subtitle")}</p>
            </div>
          </div>
          <Button asChild variant="ghost">
            <Link to="/dashboard">{t("home.messages.openInbox")} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
          </Button>
        </div>

        <div className="mt-5 divide-y divide-border">
          {messages.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Inbox className="h-6 w-6 opacity-50" />
              {t("home.messages.empty")}
            </div>
          ) : (
            messages.map((m: any) => {
              const incoming = m.recipient_id === userId;
              const rfqId = m.rfq_id;
              return (
                <Link
                  key={m.id}
                  to="/dashboard/rfqs/$id"
                  params={{ id: rfqId }}
                  className="flex items-start gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-md transition"
                >
                  <span className={`mt-1 h-2 w-2 rounded-full ${incoming ? "bg-gold" : "bg-muted-foreground/40"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-foreground truncate">
                        {m.rfqs?.group_name ?? t("home.messages.thread")}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {incoming ? "" : t("home.messages.youPrefix") + " "}{m.body}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function OpenRequestsSection() {
  const { data: rfqs = [] } = useQuery({
    queryKey: ["home-open-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rfqs")
        .select("id,title,group_type,destination_city,destination_country,check_in,check_out,nights,guests_count,rooms_needed,currency,budget_max")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  if (rfqs.length === 0) return null;

  return (
    <section className="container-page py-20">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-3xl md:text-4xl text-primary">Open group requests</h2>
          <p className="mt-2 text-muted-foreground">Live Group Requests from organizers — hotels can review and reply directly.</p>
        </div>
        <Button asChild variant="ghost"><Link to="/requests">View all <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link></Button>
      </div>
      <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rfqs.map((r) => (
          <Link key={r.id} to="/requests/$id" params={{ id: r.id }}>
            <Card className="h-full hover:shadow-[var(--shadow-elevated)] transition border-border">
              <CardContent className="p-5 space-y-2">
                <Badge className="bg-success/15 text-success border-0 uppercase tracking-wide">{r.group_type}</Badge>
                <h3 className="font-display text-lg text-primary line-clamp-2">{r.title}</h3>
                <div className="text-sm text-muted-foreground">{r.destination_city}, {r.destination_country}</div>
                <div className="text-sm text-muted-foreground">{r.check_in} → {r.check_out} · {r.guests_count} guests · {r.rooms_needed} rooms</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
