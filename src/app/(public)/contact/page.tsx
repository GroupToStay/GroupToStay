import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/contact";

export const metadata: Metadata = {
  title: "Contact",
  alternates: { canonical: "/contact" },
  openGraph: { url: "https://group-to-stay.vercel.app/contact" },
};

export default function Page() {
  return <RoutePage />;
}
