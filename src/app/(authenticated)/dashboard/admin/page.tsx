import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth/server-authorization";

type PageProps = { searchParams: Promise<{ tab?: string }> };

const LEGACY_ADMIN_TARGETS: Record<string, string> = {
  companies: "/admin/hotel-companies",
  hotels: "/admin/hotel-listings",
  interest: "/admin/subscription-interest",
  requests: "/admin/group-requests",
  users: "/admin/users",
};

export default async function LegacyAdminRedirect({ searchParams }: PageProps) {
  await requireAdminPermission();
  const { tab } = await searchParams;
  redirect((tab && LEGACY_ADMIN_TARGETS[tab]) || "/admin");
}
