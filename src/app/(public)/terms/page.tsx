import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/terms";

export const metadata = createPageMetadata({
  title: "Terms and conditions",
  description: "Read the terms and conditions that govern use of the GroupToStay marketplace.",
  path: "/terms",
});

export default function Page() {
  return <RoutePage />;
}
