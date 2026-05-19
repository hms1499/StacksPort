"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { usePairPriceHistory } from "@/hooks/useMarketData";
import { pairRateSeries, pctChange } from "@/lib/swap-chart";
import type { SwapToken } from "@/lib/direct-swap";

// ─── SVG Sparkline ────────────────────────────────────────────────────────────

function Sparkline({
  series,
  positive,
  width = 120,
  height = 36,
}: {
  series: number[];
  positive: boolean | null;
  width?: number;
  height?: number;
}) {
  const points = useMemo(() => {
    if (series.length < 2) return "";
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    const pad = 2;
    return series
      .map((v, i) => {
        const x = pad + (i / (series.length - 1)) * (width - pad * 2);
        const y = pad + (1 - (v - min) / range) * (height - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [series, width, height]);

  const color =
    positive === true
      ? "var(--color-green, #22c55e)"
      : positive === false
      ? "#ef4444"
      : "var(--text-muted)";

  if (!points) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className="overflow-visible"
    >
      <polyline points={points} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SwapPairChart({
  fromToken,
  toToken,
}: {
  fromToken: SwapToken;
  toToken: SwapToken;
}) {
  const { data, isLoading } = usePairPriceHistory(fromToken.id, toToken.id);

  const series = useMemo(
    () => (data ? pairRateSeries(data[0], data[1]) : []),
    [data]
  );
  const pct = useMemo(() => pctChange(series), [series]);

  const positive = pct === null ? null : pct >= 0;

  const pctColor =
    positive === true
      ? "rgb(34,197,94)"
      : positive === false
      ? "rgb(239,68,68)"
      : "var(--text-muted)";

  const PctIcon =
    positive === true ? TrendingUp : positive === false ? TrendingDown : Minus;

  // Skeleton while loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-between py-2">
        <div className="h-3 w-28 rounded animate-pulse" style={{ backgroundColor: "var(--bg-elevated)" }} />
        <div className="h-3 w-16 rounded animate-pulse" style={{ backgroundColor: "var(--bg-elevated)" }} />
      </div>
    );
  }

  // Not enough data to draw
  if (series.length < 2) return null;

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-1.5">
        <PctIcon size={12} style={{ color: pctColor }} />
        <span className="text-xs font-semibold tabular-nums" style={{ color: pctColor }}>
          {pct !== null
            ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
            : "—"}
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>7d</span>
      </div>
      <Sparkline series={series} positive={positive} />
    </div>
  );
}
