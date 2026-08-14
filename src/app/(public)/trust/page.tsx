import { createPageMetadata } from "@/lib/seo";
import { TrustPage as RoutePage } from "@/routes/trust";

export const metadata = createPageMetadata({
  title: "Trust and safety",
  description:
    "Learn how GroupToStay protects group organizers, hotels, accounts, and marketplace data.",
  path: "/trust",
});

export default function Page() {
  return <RoutePage />;
}
