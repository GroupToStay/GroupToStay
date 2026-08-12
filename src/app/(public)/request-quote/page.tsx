import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/request-quote";

export const metadata: Metadata = {
  title: "Request a quote",
  alternates: { canonical: "/request-quote" },
  openGraph: { url: "https://group-to-stay.vercel.app/request-quote" },
};

export default function Page() {
  return <RoutePage />;
}
