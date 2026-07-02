import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Star, Search } from "lucide-react";
import { useCities, useLocalizedName } from "@/hooks/use-master-data";
import { EmptyState } from "@/components/empty-state";
import { AccessDenied } from "@/components/access-denied";
import { useRoles } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/hotels/")({
  head: () => ({ meta: [{ title: "Group-ready hotels — GroupToStay" }, { name: "description", content: "Admin-only hotel directory." }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const localized = useLocalizedName();
  const { loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useRoles();
  const [q, setQ] = useState("");
  const [cityId, setCityId] = useState<string>("__any");
  const [stars, setStars] = useState<string>("__any");


  const { data: hotels = [] } = useQuery({
    enabled: isAdmin,

    queryKey: ["hotels-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hotels")
        .select("id,slug,name,city,country,city_id,country_id,star_rating,cover_image,description,amenities,featured")
        .eq("status", "approved")
        .order("featured", { ascending: false })
        .order("name");
      return data ?? [];
    },
  });

  const { data: cities = [] } = useCities();
  const filtered = hotels.filter(h => {
    if (cityId !== "__any" && h.city_id !== cityId) return false;
    if (stars !== "__any" && h.star_rating !== Number(stars)) return false;
    if (q && !(`${h.name} ${h.city}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  if (authLoading || rolesLoading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) {
    return <AccessDenied />;
  }

  return (

    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground">
          <div className="container-page py-14">
            <h1 className="font-display text-4xl">{t("hotels.title")}</h1>
            <p className="mt-2 text-primary-foreground/80">{t("hotels.subtitle")}</p>
          </div>
        </section>

        <div className="container-page py-6 grid md:grid-cols-[1fr_200px_140px] gap-3 sticky top-16 bg-background z-30 border-b border-border">
          <Input placeholder={t("hotels.searchPlaceholder")} value={q} onChange={e => setQ(e.target.value)} />
          <Select value={cityId} onValueChange={setCityId}>
            <SelectTrigger><SelectValue placeholder={t("hotels.filterCity")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any">{t("hotels.any")}</SelectItem>
              {cities.map(c => <SelectItem key={c.id} value={c.id}>{localized(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stars} onValueChange={setStars}>
            <SelectTrigger><SelectValue placeholder={t("hotels.filterStars")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any">{t("hotels.any")}</SelectItem>
              {[5,4,3,2,1].map(n => <SelectItem key={n} value={String(n)}>{n}★</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="container-page py-10">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title={t("hotels.empty")}
              description="Try adjusting your filters, or explore our other destinations."
              actionLabel="Post a group request"
              actionTo="/request-quote"
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(h => (
                <Link key={h.id} to="/hotels/$id" params={{ id: h.slug ?? h.id }} className="group rounded-lg overflow-hidden border border-border bg-card hover:shadow-[var(--shadow-elevated)] transition">
                  <div className="aspect-[4/3] overflow-hidden bg-muted relative">
                    {h.cover_image && <img loading="lazy" src={h.cover_image} alt={h.name} className="h-full w-full object-cover group-hover:scale-105 transition" />}
                    {h.featured && <Badge className="absolute top-3 start-3 bg-gold text-gold-foreground border-0">Featured</Badge>}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-1 text-gold">
                      {Array.from({ length: h.star_rating ?? 0 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                    </div>
                    <h3 className="font-display text-lg mt-2 text-primary">{h.name}</h3>
                    <div className="text-sm text-muted-foreground">{h.city}, {h.country}</div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{h.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
