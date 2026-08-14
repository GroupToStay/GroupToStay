import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/for-hotels";

export const metadata = createPageMetadata({
  title: "Group booking opportunities for hotels",
  description:
    "Join GroupToStay to receive matched group accommodation requests and submit competitive hotel offers.",
  path: "/for-hotels",
});

export default function Page() {
  return <RoutePage />;
}
