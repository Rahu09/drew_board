import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";
import { logoDataUri } from "@/lib/logo-data-uri";

export const alt = siteConfig.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social preview image. Twitter/X falls back to it (og:image) as well.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#f5f5f5",
          backgroundImage:
            "radial-gradient(circle, #d4d4d4 2px, transparent 2px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={logoDataUri} width={146} height={98} />
          <div style={{ fontSize: 96, fontWeight: 700, color: "#0a0a0a" }}>
            {siteConfig.name}
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 44,
            color: "#262626",
            maxWidth: 960,
            lineHeight: 1.3,
          }}
        >
          A real-time collaborative whiteboard for your team.
        </div>
      </div>
    ),
    size
  );
}
