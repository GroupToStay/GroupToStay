import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/cookies";

export const metadata = createPageMetadata({
  title: "Cookie policy",
  description: "Learn how GroupToStay uses cookies and similar technologies.",
  path: "/cookies",
});

export default function Page() {
  return <RoutePage />;
}
