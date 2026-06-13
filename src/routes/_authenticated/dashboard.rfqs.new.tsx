import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/rfqs/new")({
  component: () => <Navigate to="/request-quote" />,
});
