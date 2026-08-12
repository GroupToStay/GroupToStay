import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/about";

export const metadata: Metadata = {
  title: "About",
  alternates: { canonical: "/about" },
  openGraph: { url: "https://group-to-stay.vercel.app/about" },
};

export default function Page() {
  return <RoutePage />;
}
