import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/terms";

export const metadata: Metadata = {
  title: "Terms and conditions",
  alternates: { canonical: "/terms" },
  openGraph: { url: "https://group-to-stay.vercel.app/terms" },
};

export default function Page() {
  return <RoutePage />;
}
