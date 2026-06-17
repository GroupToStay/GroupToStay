import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin } from "lucide-react";

export const Route = createFileRoute("/hotels/$id")({
  head: () => ({ meta: [{ title: "Hotel — GroupToStay" }] }),
  component: Page,
  errorComponent: () => <ErrorView />,
  notFoundComponent: () => <ErrorView />,
});

function ErrorView() {
  return <div className="min-h-screen grid place-items-center"><div>Hotel not found. <Link to="/hotels" className="underline">Back to hotels</Link></div></div>;
}

function Page() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["hotel", id],
    queryFn: async () => {
      // Look up by slug first, then by id as fallback (back-compat for old links).
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const lookupColumn = uuidRe.test(id) ? "id" : "slug";
      const { data: h } = await supabase.from("hotels").select("*").eq(lookupColumn, id).eq("status", "approved").maybeSingle();
      if (!h) return null;
      const { data: rooms } = await supabase.from("hotel_rooms").select("*").eq("hotel_id", h.id);
      return { hotel: h, rooms: rooms ?? [] };
    },
  });

  if (isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">{t("common.loading")}</div>;
  if (!data) throw notFound();
  const { hotel, rooms } = data;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="aspect-[21/9] w-full bg-muted overflow-hidden">
          {hotel.cover_image && <img src={hotel.cover_image} alt={hotel.name} className="h-full w-full object-cover" />}
        </div>
        <div className="container-page py-10 grid lg:grid-cols-[1fr_320px] gap-10">
          <div>
            <div className="flex items-center gap-1 text-gold">
              {Array.from({ length: hotel.star_rating ?? 0 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
            </div>
            <h1 className="font-display text-3xl md:text-4xl text-primary mt-2">{hotel.name}</h1>
            <div className="mt-2 flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" /> {hotel.address}, {hotel.city}, {hotel.country}</div>
            <p className="mt-6 text-foreground/80 leading-relaxed">{hotel.description}</p>

            {hotel.amenities && hotel.amenities.length > 0 && (
              <>
                <h2 className="font-display text-xl text-primary mt-10">{t("hotels.amenities")}</h2>
                <div className="mt-3 flex flex-wrap gap-2">{hotel.amenities.map((a: string) => <Badge key={a} variant="secondary">{a}</Badge>)}</div>
              </>
            )}

            {rooms.length > 0 && (
              <>
                <h2 className="font-display text-xl text-primary mt-10">{t("hotels.rooms")}</h2>
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  {rooms.map(r => (
                    <div key={r.id} className="rounded-lg border border-border p-4 bg-card">
                      <div className="font-semibold">{r.room_type}</div>
                      <div className="text-sm text-muted-foreground">Capacity {r.capacity} · {r.count_available} available</div>
                      <div className="mt-2 text-primary"><span className="text-sm text-muted-foreground">{t("hotels.from")} </span><span className="font-display text-lg">{r.currency} {r.base_price}</span><span className="text-sm text-muted-foreground">{t("hotels.perNight")}</span></div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside className="rounded-xl border border-border bg-surface p-6 h-fit sticky top-24">
            <h3 className="font-display text-lg text-primary">{t("nav.getQuote")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">Get competing offers from {hotel.city} hotels including this one.</p>
            <Button asChild variant="gold" className="w-full mt-4"><Link to="/request-quote" search={{ city: hotel.city, country: hotel.country }}>{t("nav.getQuote")}</Link></Button>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
