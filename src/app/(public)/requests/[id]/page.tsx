import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/requests.$id";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const canonicalPath = `/requests/${encodeURIComponent(id)}`;
  return createPageMetadata({
    title: "Group request",
    description: "View this group accommodation request on GroupToStay.",
    path: canonicalPath,
    index: false,
  });
}

export default function Page() {
  return <RoutePage />;
}
