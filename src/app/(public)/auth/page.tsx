import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/auth";

export const metadata = createPageMetadata({
  title: "Sign in",
  description: "Sign in to your GroupToStay account.",
  path: "/auth",
  index: false,
});

export default function Page() {
  return <RoutePage />;
}
