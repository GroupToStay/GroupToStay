import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  alternates: { canonical: "/pricing" },
  openGraph: { url: "https://group-to-stay.vercel.app/pricing" },
};

export default function Page() {
  return <RoutePage />;
}
