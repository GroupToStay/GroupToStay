import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useRoles } from "@/hooks/use-role";
import { AccessDenied } from "@/components/access-denied";

export const Route = createFileRoute("/_authenticated/dashboard/rfqs/new")({
  component: Page,
});

function Page() {
  const { isOrganizer, loading } = useRoles();
  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!isOrganizer) return <AccessDenied message="Only organizers can create new requests." />;
  return <Navigate to="/request-quote" />;
}
