import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/how-it-works";

export const metadata: Metadata = {
  title: "How it works",
  alternates: { canonical: "/how-it-works" },
  openGraph: { url: "https://group-to-stay.vercel.app/how-it-works" },
};

export default function Page() {
  return <RoutePage />;
}
