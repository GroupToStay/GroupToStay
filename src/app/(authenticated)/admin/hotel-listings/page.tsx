import type { Metadata } from "next";
import { Page as HotelListings } from "@/routes/_authenticated/admin.hotel-listings";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export const metadata: Metadata = { title: "Hotel listings | GroupToStay" };

export default async function HotelListingsPage() {
  await requireAdminPermission("manage_hotels");
  return <HotelListings />;
}
