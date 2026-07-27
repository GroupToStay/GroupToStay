import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "profile" } });
  },
  component: () => null,
});
