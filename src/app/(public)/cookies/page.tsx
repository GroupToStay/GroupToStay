import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/cookies";

export const metadata: Metadata = {
  title: "Cookie policy",
  alternates: { canonical: "/cookies" },
  openGraph: { url: "https://group-to-stay.vercel.app/cookies" },
};

export default function Page() {
  return <RoutePage />;
}
