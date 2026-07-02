import { createFileRoute } from "@tanstack/react-router";
import { AccessDenied } from "@/components/access-denied";

export const Route = createFileRoute("/hotel-list")({
  head: () => ({
    meta: [
      { title: "Access denied - GroupToStay" },
      {
        name: "description",
        content: "Hotel directory browsing is restricted to administrators.",
      },
    ],
  }),
  component: HotelListAccessDenied,
});

function HotelListAccessDenied() {
  return (
    <AccessDenied message="GroupToStay is a B2B RFQ marketplace. Hotel directory browsing is available to administrators only." />
  );
}
