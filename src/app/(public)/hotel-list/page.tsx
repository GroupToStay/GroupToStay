import { createPageMetadata } from "@/lib/seo";
import { HotelListAccessDenied as RoutePage } from "@/routes/hotel-list";

export const metadata = createPageMetadata({
  title: "Hotel directory",
  description: "GroupToStay hotel directory access.",
  path: "/hotel-list",
  index: false,
});

export default function Page() {
  return <RoutePage />;
}
