"use client";

import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/dashboard/rfqs/new")({
  component: Page,
});

export function Page() {
  const { t } = useTranslation();
  const { isOrganizer, isHotel, isAdmin, loading } = useRoles();
  if (loading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  // Hotel users are suppliers — redirect to their group requests inbox.
  if (isHotel) return <Navigate to="/dashboard/invitations" />;
  if (isAdmin) return <Navigate to="/admin/group-requests" />;
  if (!isOrganizer) return <Navigate to="/dashboard" />;
  return <Navigate to="/request-quote" />;
}
