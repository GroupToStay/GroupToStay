import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles.css";
import "@/lib/fonts";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "GroupToStay",
  description: "One request. Multiple hotel offers.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="notranslate" translate="no">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
