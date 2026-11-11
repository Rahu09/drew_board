import { ImageResponse } from "next/og";

import { logoDataUri } from "@/lib/logo-data-uri";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon. Safari does not use the SVG favicon (app/icon.svg).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={logoDataUri} width={146} height={98} />
      </div>
    ),
    size
  );
}
