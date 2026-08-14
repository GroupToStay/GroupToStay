import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/subscription.coming-soon";

export const metadata = createPageMetadata({
  title: "Subscriptions",
  description: "GroupToStay subscription plans are coming soon.",
  path: "/subscription/coming-soon",
  index: false,
});

export default function Page() {
  return <RoutePage />;
}
