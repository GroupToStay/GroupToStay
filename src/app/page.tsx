import { createPageMetadata, SITE_NAME, SITE_URL, serializeJsonLd } from "@/lib/seo";
import { Landing } from "@/routes/index";

export const metadata = createPageMetadata({
  title: "Group hotel booking made simple",
  description:
    "Request group accommodation once, compare verified hotel offers, and negotiate securely.",
  path: "/",
});

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json">{serializeJsonLd(organizationSchema)}</script>
      <Landing />
    </>
  );
}
