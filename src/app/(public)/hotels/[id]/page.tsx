import type { Metadata } from "next";
import { cache } from "react";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { createPageMetadata, SITE_URL, serializeJsonLd } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/hotels.$id";

type PageProps = { params: Promise<{ id: string }> };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getApprovedHotel = cache(async (id: string) => {
  const supabase = await createSupabaseServerClient();
  const lookupColumn = uuidPattern.test(id) ? "id" : "slug";
  const { data } = await supabase
    .from("hotels")
    .select("name,description,city,country,address,star_rating,cover_image")
    .eq(lookupColumn, id)
    .eq("status", "approved")
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const hotel = await getApprovedHotel(id);
  const canonicalPath = `/hotels/${encodeURIComponent(id)}`;
  const title = hotel?.name ?? "Hotel details";
  const description =
    hotel?.description?.slice(0, 300) ?? "View an approved GroupToStay hotel property.";

  return createPageMetadata({
    title,
    description,
    path: canonicalPath,
    images: hotel?.cover_image ? [hotel.cover_image] : undefined,
    index: Boolean(hotel),
  });
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const hotel = await getApprovedHotel(id);
  const structuredData = hotel
    ? {
        "@context": "https://schema.org",
        "@type": "Hotel",
        name: hotel.name,
        description: hotel.description ?? undefined,
        starRating: hotel.star_rating
          ? { "@type": "Rating", ratingValue: hotel.star_rating }
          : undefined,
        image: hotel.cover_image ?? undefined,
        address: {
          "@type": "PostalAddress",
          streetAddress: hotel.address ?? undefined,
          addressLocality: hotel.city ?? undefined,
          addressCountry: hotel.country ?? undefined,
        },
        url: `${SITE_URL}/hotels/${encodeURIComponent(id)}`,
      }
    : null;

  return (
    <>
      {structuredData ? (
        <script type="application/ld+json">{serializeJsonLd(structuredData)}</script>
      ) : null}
      <RoutePage />
    </>
  );
}
