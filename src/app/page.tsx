import type { Metadata } from "next";
import { Landing } from "@/routes/index";

export const metadata: Metadata = {
  title: "GroupToStay | One request. Multiple hotel offers.",
  description:
    "Request group accommodation once, compare verified hotel offers, and negotiate securely.",
  alternates: { canonical: "/" },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "GroupToStay",
  url: "https://group-to-stay.vercel.app",
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
      <Landing />
    </>
  );
}
