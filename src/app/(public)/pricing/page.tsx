import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/pricing";

export const metadata = createPageMetadata({
  title: "Pricing",
  description: "Explore GroupToStay pricing for group organizers and hotel partners.",
  path: "/pricing",
});

export default function Page() {
  return <RoutePage />;
}
