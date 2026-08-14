import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const monthly = [
    "/how-it-works",
    "/for-hotels",
    "/pricing",
    "/about",
    "/contact",
    "/hotels",
    "/requests",
  ];
  const yearly = ["/trust", "/privacy", "/terms", "/cookies"];

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/request-quote`, changeFrequency: "weekly", priority: 0.9 },
    ...monthly.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: path === "/pricing" ? 0.7 : path === "/about" || path === "/contact" ? 0.5 : 0.8,
    })),
    ...yearly.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "yearly" as const,
      priority: path === "/trust" ? 0.4 : 0.3,
    })),
  ];
}
