import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/request-quote";

export const metadata = createPageMetadata({
  title: "Request group hotel quotes",
  description:
    "Submit one group accommodation request and receive competing offers from approved hotels.",
  path: "/request-quote",
});

export default function Page() {
  return <RoutePage />;
}
