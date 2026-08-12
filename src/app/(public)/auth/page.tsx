import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/auth";

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/auth" },
  openGraph: { url: "https://group-to-stay.vercel.app/auth" },
};

export default function Page() {
  return <RoutePage />;
}
