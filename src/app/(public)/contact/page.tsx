import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/contact";

export const metadata = createPageMetadata({
  title: "Contact us",
  description:
    "Contact the GroupToStay team for help with group accommodation requests or hotel partnerships.",
  path: "/contact",
});

export default function Page() {
  return <RoutePage />;
}
