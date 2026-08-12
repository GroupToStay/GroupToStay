import type { Metadata } from "next";
import { Page as RoutePage } from "@/routes/requests.$id";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const canonicalPath = `/requests/${encodeURIComponent(id)}`;
  return {
    title: "Group request",
    alternates: { canonical: canonicalPath },
    openGraph: { url: `https://group-to-stay.vercel.app${canonicalPath}` },
  };
}

export default function Page() {
  return <RoutePage />;
}
