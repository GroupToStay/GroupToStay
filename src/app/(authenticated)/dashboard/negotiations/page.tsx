"use client";
import { LegacyRoutePage } from "@/app/legacy-route-page";
import { Route } from "@/routes/_authenticated/dashboard.negotiations";
export default function Page() {
  return <LegacyRoutePage route={Route} />;
}
