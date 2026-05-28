"use client";

import { memo, useRef, useState } from "react";

const POSITIVE = "#22c55e";
const NEGATIVE = "#ef4444";

type Props = {
  prices: number[];
  isPositive: boolean;
  width?: number;
  height?: number;
  /** Sizing class applied to the svg (and wrapper when interactive). */
  className?: string;
  /** Render a gradient area fill below the line. */
  fill?: boolean;
  /** Enable crosshair hover with a value tooltip. Needs `formatValue`. */
  interactive?: boolean;
  /** Formats the hovered value for the tooltip. */
  formatValue?: (v: number) => string;
  /** Vertical breathing room (px) reserved top+bottom inside the viewBox. */
  padY?: number;
};

// Shared price-series sparkline. Replaces the near-identical inline copies that
// lived in STXMarketStats and TrendingTokens. The scaling math (min/max/range →
// polyline) is the part that was duplicated; `fill` and `interactive` cover the
// two features that differed between the call sites.
function PriceSparkline({
  prices,
  isPositive,
  width = 80,
  height = 40,
  className = "w-20 h-10",
  fill = false,
  interactive = false,
  formatValue,
  padY = 4,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (prices.length < 2) return <div className={className} />;

  const w = width;
  const h = height;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const offY = padY / 2;

  const coords = prices.map((p, i) => ({
    x: (i / (prices.length - 1)) * w,
    y: h - ((p - min) / range) * (h - padY) - offY,
  }));
  const pts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`);
  const stroke = isPositive ? POSITIVE : NEGATIVE;

  const polyline = (
    <polyline
      points={pts.join(" ")}
      fill="none"
      stroke={stroke}
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );

  const fillEl = fill ? (
    <>
      <defs>
        <linearGradient id={`sparkGrad-${stroke.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.15} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={`M ${pts.join(" L ")} L ${coords[coords.length - 1].x.toFixed(1)},${h} L ${coords[0].x.toFixed(1)},${h} Z`}
        fill={`url(#sparkGrad-${stroke.slice(1)})`}
      />
    </>
  ) : null;

  if (!interactive) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
        {fillEl}
        {polyline}
      </svg>
    );
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.round((relX / w) * (prices.length - 1));
    setHoverIdx(Math.max(0, Math.min(prices.length - 1, idx)));
  }

  const hover = hoverIdx !== null ? { ...coords[hoverIdx], price: prices[hoverIdx] } : null;

  return (
    <div className={`relative ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className={`${className} cursor-crosshair`}
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {fillEl}
        {polyline}
        {hover && (
          <>
            <line
              x1={hover.x}
              y1={0}
              x2={hover.x}
              y2={h}
              stroke={stroke}
              strokeWidth="0.5"
              strokeDasharray="2 2"
              opacity={0.6}
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r={2.2}
              fill={stroke}
              stroke="var(--bg-card)"
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      {hover && formatValue && (
        <div
          className="pointer-events-none absolute -top-7 text-[10px] font-data font-semibold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap z-10"
          style={{
            left: `${(hover.x / w) * 100}%`,
            transform: "translateX(-50%)",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
          }}
        >
          {formatValue(hover.price)}
        </div>
      )}
    </div>
  );
}

export default memo(PriceSparkline);
