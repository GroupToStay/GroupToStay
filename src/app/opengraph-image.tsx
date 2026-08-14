import { ImageResponse } from "next/og";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const alt = "GroupToStay — group hotel booking made simple";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #062f2c 0%, #0f766e 58%, #d6a84b 100%)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: "72px",
        textAlign: "center",
        width: "100%",
      }}
    >
      <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-3px" }}>{SITE_NAME}</div>
      <div style={{ fontSize: 40, marginTop: 24 }}>Group hotel booking made simple</div>
      <div style={{ fontSize: 25, marginTop: 28, maxWidth: 900, opacity: 0.88 }}>
        {DEFAULT_DESCRIPTION}
      </div>
    </div>,
    size,
  );
}
