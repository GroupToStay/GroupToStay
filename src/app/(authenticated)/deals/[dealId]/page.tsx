"use client";
import { LegacyRoutePage } from "@/app/legacy-route-page";
import { Route } from "@/routes/_authenticated/deals.$dealId";
export default function Page() {
  return <LegacyRoutePage route={Route} />;
}
