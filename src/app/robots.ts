import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/dashboard/", "/deals/"] },
    sitemap: "https://group-to-stay.vercel.app/sitemap.xml",
  };
}
