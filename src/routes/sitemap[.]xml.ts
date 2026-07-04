import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries = [
          { path: "/", priority: "1.0", changefreq: "weekly" },
          { path: "/how-it-works", priority: "0.8", changefreq: "monthly" },
          { path: "/hotels", priority: "0.9", changefreq: "daily" },
          { path: "/for-hotels", priority: "0.8", changefreq: "monthly" },
          { path: "/pricing", priority: "0.7", changefreq: "monthly" },
          { path: "/about", priority: "0.5", changefreq: "monthly" },
          { path: "/contact", priority: "0.5", changefreq: "monthly" },
          { path: "/request-quote", priority: "0.9", changefreq: "weekly" },
          { path: "/auth", priority: "0.3", changefreq: "yearly" },
        ];
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...entries.map(
            (e) =>
              `  <url><loc>${BASE_URL}${e.path}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
          ),
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
