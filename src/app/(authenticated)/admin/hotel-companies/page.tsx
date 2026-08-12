import type { Metadata } from "next";
import { Page as HotelCompanies } from "@/routes/_authenticated/admin.hotel-companies";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

export const metadata: Metadata = { title: "Hotel companies | GroupToStay" };

export default async function HotelCompaniesPage() {
  await requireAdminPermission("manage_hotels");
  return <HotelCompanies />;
}
