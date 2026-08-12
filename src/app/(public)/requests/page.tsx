import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/requests.index";

export const metadata: Metadata = {
  title: "Group requests",
  alternates: { canonical: "/requests" },
  openGraph: { url: "https://group-to-stay.vercel.app/requests" },
};

export default function Page() {
  return <RoutePage />;
}
