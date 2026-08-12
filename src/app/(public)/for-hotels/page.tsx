import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/for-hotels";

export const metadata: Metadata = {
  title: "For hotels",
  alternates: { canonical: "/for-hotels" },
  openGraph: { url: "https://group-to-stay.vercel.app/for-hotels" },
};

export default function Page() {
  return <RoutePage />;
}
