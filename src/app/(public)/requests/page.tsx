import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/requests.index";

export const metadata = createPageMetadata({
  title: "Group requests",
  description: "Browse active group accommodation requests on GroupToStay.",
  path: "/requests",
});

export default function Page() {
  return <RoutePage />;
}
