import { ImageResponse } from "next/og";

// Renders the StacksPort brand mark as a square PNG for PWA / manifest icons.
// Full-bleed gradient background with the bar-chart glyph kept inside the
// maskable safe zone (~80% center), so the same asset is valid as both an
// "any" and a "maskable" icon without clipping on Android adaptive masks.
export function renderBrandIcon(size: number): ImageResponse {
  const glyph = Math.round(size * 0.42);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #00E5A0, #0094FF)",
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#060C18"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
