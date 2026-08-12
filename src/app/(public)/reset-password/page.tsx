import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/reset-password";

export const metadata: Metadata = {
  title: "Reset password",
  alternates: { canonical: "/reset-password" },
  openGraph: { url: "https://group-to-stay.vercel.app/reset-password" },
};

export default function Page() {
  return <RoutePage />;
}
