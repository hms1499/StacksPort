"use client";

import type { Timeframe } from "./TimeframeToggle";
import type { Metric } from "./MetricToggle";

interface ColorLegendProps {
  range?: number;
  timeframe?: Timeframe;
  metric?: Metric;
}

const METRIC_LABEL: Record<Metric, string> = {
  change: "% change",
  marketCap: "market cap",
  volume: "24h volume",
};

export default function ColorLegend({
  range = 10,
  timeframe,
  metric = "change",
}: ColorLegendProps) {
  return (
    <div
      className="absolute bottom-2 right-2 pointer-events-none hidden sm:flex items-center gap-2.5 px-2.5 py-1 rounded-md"
      style={{
        backgroundColor: "rgba(0,0,0,0.55)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {/* Size encoding — bigger bubble = more of the selected metric. */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Size
        </span>
        <span className="flex items-end gap-1" aria-hidden>
          <span
            className="rounded-full"
            style={{ width: 5, height: 5, backgroundColor: "rgba(180,180,180,0.7)" }}
          />
          <span
            className="rounded-full"
            style={{ width: 9, height: 9, backgroundColor: "rgba(180,180,180,0.7)" }}
          />
        </span>
        <span className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
          {METRIC_LABEL[metric]}
        </span>
      </div>

      <div className="h-3 w-px" style={{ backgroundColor: "var(--border-subtle)" }} />

      {/* Color encoding — % change over the active timeframe. */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Color
        </span>
        {timeframe && (
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            {timeframe.toUpperCase()}
          </span>
        )}
        <span className="text-[10px] font-mono" style={{ color: "#f87171" }}>
          −{range}%
        </span>
        <div
          className="h-1.5 w-16 rounded-full"
          style={{
            background:
              "linear-gradient(to right, #f87171 0%, rgba(120,120,120,0.6) 50%, #34d399 100%)",
          }}
        />
        <span className="text-[10px] font-mono" style={{ color: "#34d399" }}>
          +{range}%
        </span>
      </div>
    </div>
  );
}
