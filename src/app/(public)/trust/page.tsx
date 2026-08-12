import type { Metadata } from "next";
import { TrustPage as RoutePage } from "@/routes/trust";

export const metadata: Metadata = {
  title: "Trust and safety",
  alternates: { canonical: "/trust" },
  openGraph: { url: "https://group-to-stay.vercel.app/trust" },
};

export default function Page() {
  return <RoutePage />;
}
