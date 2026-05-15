"use client";

import type { Timeframe } from "./TimeframeToggle";

interface ColorLegendProps {
  range?: number;
  timeframe?: Timeframe;
}

export default function ColorLegend({ range = 10, timeframe }: ColorLegendProps) {
  return (
    <div
      className="absolute bottom-2 right-2 pointer-events-none hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md"
      style={{
        backgroundColor: "rgba(0,0,0,0.55)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {timeframe && (
        <span
          className="text-[10px] font-mono mr-1"
          style={{ color: "var(--text-muted)" }}
        >
          {timeframe.toUpperCase()}
        </span>
      )}
      <span className="text-[10px] font-mono" style={{ color: "#f87171" }}>
        −{range}%
      </span>
      <div
        className="h-1.5 w-24 rounded-full"
        style={{
          background:
            "linear-gradient(to right, #f87171 0%, rgba(120,120,120,0.6) 50%, #34d399 100%)",
        }}
      />
      <span className="text-[10px] font-mono" style={{ color: "#34d399" }}>
        +{range}%
      </span>
    </div>
  );
}
