"use client";
import { LegacyRoutePage } from "@/app/legacy-route-page";
import { Route } from "@/routes/_authenticated/dashboard.rfqs.$id.compare";
export default function Page() {
  return <LegacyRoutePage route={Route} />;
}
