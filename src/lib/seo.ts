import type { Metadata } from "next";

export const SITE_NAME = "GroupToStay";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/u, "") ?? "https://group-to-stay.vercel.app";
export const DEFAULT_DESCRIPTION =
  "Request group accommodation once, compare hotel offers, and negotiate securely with GroupToStay.";
export const SOCIAL_IMAGE_PATH = "/opengraph-image";

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, "\\u003c");
}

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  images?: string[];
};

export function createPageMetadata({
  title,
  description,
  path,
  index = true,
  images,
}: PageMetadataOptions): Metadata {
  const canonical = path.startsWith("/") ? path : `/${path}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: images ?? [SOCIAL_IMAGE_PATH],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images ?? [SOCIAL_IMAGE_PATH],
    },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
  };
}
