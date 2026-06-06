import { ImageResponse } from "next/og";

export const alt = "StacksPort - Non-Custodial sBTC DCA on Stacks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#060C18",
          color: "#DDE8F8",
          padding: "72px 84px",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 720,
            height: 720,
            borderRadius: "50%",
            top: -420,
            right: -100,
            background: "rgba(0,229,160,0.16)",
            filter: "blur(30px)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #00E5A0, #0094FF)",
                fontSize: 30,
                fontWeight: 800,
                color: "#060C18",
              }}
            >
              S
            </div>
            <span style={{ fontSize: 30, fontWeight: 700 }}>StacksPort</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
            <span
              style={{
                color: "#00E5A0",
                fontSize: 22,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 4,
              }}
            >
              Live on Stacks mainnet
            </span>
            <span
              style={{
                marginTop: 22,
                fontSize: 70,
                lineHeight: 1.05,
                fontWeight: 800,
                letterSpacing: -3,
              }}
            >
              Non-custodial sBTC DCA, enforced on-chain.
            </span>
            <span
              style={{
                marginTop: 28,
                fontSize: 26,
                color: "rgba(221,232,248,0.58)",
              }}
            >
              Automate STX to sBTC. Track performance. Keep control.
            </span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
