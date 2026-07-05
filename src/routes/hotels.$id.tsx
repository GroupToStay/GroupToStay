import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin } from "lucide-react";
import { useRoles } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/access-denied";
import { HotelPhoto } from "@/components/hotel-photo";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/hotels/$id")({
  loader: async ({ params }) => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const lookupColumn = uuidRe.test(params.id) ? "id" : "slug";
    const { data } = await supabase
      .from("hotels")
      .select("name,description,city,country,address,star_rating,cover_image")
      .eq(lookupColumn, params.id)
      .eq("status", "approved")
      .maybeSingle();
    return { hotel: data };
  },
  head: ({ params, loaderData }) => {
    const h = loaderData?.hotel;
    const title = h?.name
      ? i18n.t("hotels.detailTitle", { name: h.name })
      : i18n.t("hotels.detailFallbackTitle");
    const description = h
      ? i18n
          .t(h.city ? "hotels.detailMetaWithCity" : "hotels.detailMetaWithoutCity", {
            name: h.name,
            city: h.city,
            description: h.description ?? i18n.t("hotels.detailDescription"),
          })
          .slice(0, 300)
      : i18n.t("hotels.detailOgDescription");
    const canonical = `https://groupstay-connect.lovable.app/hotels/${params.id}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "product" },
        ...(h?.cover_image ? [{ property: "og:image", content: h.cover_image }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: h
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Hotel",
                name: h.name,
                description: h.description ?? undefined,
                starRating: h.star_rating
                  ? { "@type": "Rating", ratingValue: h.star_rating }
                  : undefined,
                image: h.cover_image ?? undefined,
                address: {
                  "@type": "PostalAddress",
                  streetAddress: h.address ?? undefined,
                  addressLocality: h.city ?? undefined,
                  addressCountry: h.country ?? undefined,
                },
                url: canonical,
              }),
            },
          ]
        : undefined,
    };
  },
  component: Page,
  errorComponent: () => <ErrorView />,
  notFoundComponent: () => <ErrorView />,
});

function ErrorView() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen grid place-items-center">
      <div>
        {t("hotels.notFound")}{" "}
        <Link to="/hotels" className="underline">
          {t("hotels.backToHotels")}
        </Link>
      </div>
    </div>
  );
}

function Page() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const { isAdmin, isHotel, loading: rolesLoading } = useRoles();
  const { loading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    enabled: isAdmin,
    queryKey: ["hotel", id],

    queryFn: async () => {
      // Look up by slug first, then by id as fallback (back-compat for old links).
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const lookupColumn = uuidRe.test(id) ? "id" : "slug";
      const { data: h } = await supabase
        .from("hotels")
        .select(
          "id,name,slug,city,country,address,lat,lng,star_rating,description,amenities,cover_image,gallery,status,featured,created_at,updated_at,country_id,city_id,hotel_type_id,archived",
        )
        .eq(lookupColumn, id)
        .eq("status", "approved")
        .maybeSingle();
      if (!h) return null;
      const { data: rooms } = await supabase.from("hotel_rooms").select("*").eq("hotel_id", h.id);
      return { hotel: h, rooms: rooms ?? [] };
    },
  });

  if (authLoading || rolesLoading)
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        {t("hotels.loading")}
      </div>
    );
  if (!isAdmin) return <AccessDenied />;
  if (isLoading)
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );

  if (!data) throw notFound();
  const { hotel, rooms } = data;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="aspect-[21/9] w-full bg-muted overflow-hidden">
          {hotel.cover_image && (
            <HotelPhoto
              src={hotel.cover_image}
              alt={hotel.name}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="container-page py-10 grid lg:grid-cols-[1fr_320px] gap-10">
          <div>
            <div className="flex items-center gap-1 text-gold">
              {Array.from({ length: hotel.star_rating ?? 0 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <h1 className="font-display text-3xl md:text-4xl text-primary mt-2">{hotel.name}</h1>
            <div className="mt-2 flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" /> {hotel.address}, {hotel.city}, {hotel.country}
            </div>
            <p className="mt-6 text-foreground/80 leading-relaxed">{hotel.description}</p>

            {hotel.amenities && hotel.amenities.length > 0 && (
              <>
                <h2 className="font-display text-xl text-primary mt-10">{t("hotels.amenities")}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {hotel.amenities.map((a: string) => (
                    <Badge key={a} variant="secondary">
                      {a}
                    </Badge>
                  ))}
                </div>
              </>
            )}

            {rooms.length > 0 && (
              <>
                <h2 className="font-display text-xl text-primary mt-10">{t("hotels.rooms")}</h2>
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  {rooms.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border p-4 bg-card">
                      <div className="font-semibold">{r.room_type}</div>
                      <div className="text-sm text-muted-foreground">
                        {t("hotels.capacityAvailable", {
                          capacity: r.capacity,
                          available: r.count_available,
                        })}
                      </div>
                      <div className="mt-2 text-primary">
                        <span className="text-sm text-muted-foreground">{t("hotels.from")} </span>
                        <span className="font-display text-lg">
                          {r.currency} {r.base_price}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {t("hotels.perNight")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {isAdmin ? (
            <aside className="rounded-xl border border-border bg-surface p-6 h-fit sticky top-24">
              <h3 className="font-display text-lg text-primary">{t("hotels.adminReview")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("hotels.approvalStatus")}</p>
              <Badge className="mt-3 bg-success/15 text-success">{hotel.status}</Badge>
              <Button asChild variant="outline" className="w-full mt-4">
                <Link to="/admin/hotel-listings">{t("hotels.backToAdminReview")}</Link>
              </Button>
            </aside>
          ) : isHotel ? null : (
            <aside className="rounded-xl border border-border bg-surface p-6 h-fit sticky top-24">
              <h3 className="font-display text-lg text-primary">{t("nav.getQuote")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("hotels.offersDescription", { city: hotel.city })}
              </p>
              <Button asChild variant="gold" className="w-full mt-4">
                <Link to="/request-quote" search={{ city: hotel.city, country: hotel.country }}>
                  {t("nav.getQuote")}
                </Link>
              </Button>
            </aside>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
