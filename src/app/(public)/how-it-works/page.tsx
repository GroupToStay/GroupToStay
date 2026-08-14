import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/how-it-works";

export const metadata = createPageMetadata({
  title: "How group hotel booking works",
  description:
    "See how one group accommodation request becomes multiple comparable hotel offers on GroupToStay.",
  path: "/how-it-works",
});

export default function Page() {
  return <RoutePage />;
}
