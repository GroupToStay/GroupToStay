import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/privacy";

export const metadata = createPageMetadata({
  title: "Privacy policy",
  description:
    "Read the GroupToStay privacy policy and learn how personal and marketplace data is handled.",
  path: "/privacy",
});

export default function Page() {
  return <RoutePage />;
}
