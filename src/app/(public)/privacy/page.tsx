import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/privacy";

export const metadata: Metadata = {
  title: "Privacy policy",
  alternates: { canonical: "/privacy" },
  openGraph: { url: "https://group-to-stay.vercel.app/privacy" },
};

export default function Page() {
  return <RoutePage />;
}
