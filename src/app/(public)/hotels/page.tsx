import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/hotels.index";

export const metadata = createPageMetadata({
  title: "Hotels",
  description: "Browse approved hotels available for group accommodation through GroupToStay.",
  path: "/hotels",
});

export default function Page() {
  return <RoutePage />;
}
