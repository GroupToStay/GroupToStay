import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "@/styles.css";
import "@/lib/fonts";
import { APP_LANGUAGE_COOKIE_KEY, getTextDirection, normalizeAppLanguage } from "@/lib/locale";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, SOCIAL_IMAGE_PATH } from "@/lib/seo";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Group hotel booking made simple`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["group hotel booking", "group accommodation", "hotel quotes", "hotel RFQ"],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "travel",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Group hotel booking made simple`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    images: [SOCIAL_IMAGE_PATH],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Group hotel booking made simple`,
    description: DEFAULT_DESCRIPTION,
    images: [SOCIAL_IMAGE_PATH],
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg" },
  manifest: "/manifest.webmanifest",
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
