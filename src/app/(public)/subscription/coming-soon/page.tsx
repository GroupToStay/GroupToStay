import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/subscription.coming-soon";

export const metadata: Metadata = {
  title: "Subscriptions",
  alternates: { canonical: "/subscription/coming-soon" },
  openGraph: { url: "https://group-to-stay.vercel.app/subscription/coming-soon" },
};

export default function Page() {
  return <RoutePage />;
}
