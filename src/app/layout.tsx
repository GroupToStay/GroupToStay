import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "@/styles.css";
import "@/lib/fonts";
import { APP_LANGUAGE_COOKIE_KEY, getTextDirection, normalizeAppLanguage } from "@/lib/locale";
import { Providers } from "./providers";

const productionUrl = "https://group-to-stay.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(productionUrl),
  title: { default: "GroupToStay", template: "%s | GroupToStay" },
  description: "One request. Multiple hotel offers.",
  applicationName: "GroupToStay",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "GroupToStay",
    title: "GroupToStay",
    description: "One request. Multiple hotel offers.",
    url: productionUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "GroupToStay",
    description: "One request. Multiple hotel offers.",
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const language = normalizeAppLanguage(cookieStore.get(APP_LANGUAGE_COOKIE_KEY)?.value);
  return (
    <html lang={language} dir={getTextDirection(language)} suppressHydrationWarning>
      <body className="notranslate" translate="no">
        <Providers initialLanguage={language}>{children}</Providers>
      </body>
    </html>
  );
}
