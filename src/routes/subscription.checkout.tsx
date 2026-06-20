import { createFileRoute, redirect } from "@tanstack/react-router";

// Feature-flagged: while subscriptions_enabled = false, always redirect to coming-soon.
// When enabled, this route can host the real checkout UI.
export const Route = createFileRoute("/subscription/checkout")({
  beforeLoad: () => {
    throw redirect({ to: "/subscription/coming-soon" });
  },
  component: () => null,
});
