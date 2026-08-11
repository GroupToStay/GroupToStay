import type { MetadataRoute } from "next";

const baseUrl = "https://groupstay-connect.lovable.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const monthly = ["/how-it-works", "/for-hotels", "/pricing", "/about", "/contact"];
  const yearly = ["/trust", "/privacy", "/terms", "/cookies", "/auth"];

  return [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/request-quote`, changeFrequency: "weekly", priority: 0.9 },
    ...monthly.map((path) => ({
      url: `${baseUrl}${path}`,
      changeFrequency: "monthly" as const,
      priority: path === "/pricing" ? 0.7 : path === "/about" || path === "/contact" ? 0.5 : 0.8,
    })),
    ...yearly.map((path) => ({
      url: `${baseUrl}${path}`,
      changeFrequency: "yearly" as const,
      priority: path === "/trust" ? 0.4 : 0.3,
    })),
  ];
}
