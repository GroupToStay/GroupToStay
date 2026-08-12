import type { Metadata } from "next";
import { SettingsPage as RoutePage } from "@/routes/_authenticated/settings";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <RoutePage />;
}
