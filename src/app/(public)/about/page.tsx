import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/about";

export const metadata = createPageMetadata({
  title: "About GroupToStay",
  description:
    "Learn how GroupToStay makes sourcing and comparing group hotel accommodation simpler.",
  path: "/about",
});

export default function Page() {
  return <RoutePage />;
}
