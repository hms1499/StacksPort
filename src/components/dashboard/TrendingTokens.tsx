"use client";

import { memo, useRef, useState } from "react";
import { Info, ChevronRight } from "lucide-react";
import { useTrendingTokens } from "@/hooks/useMarketData";
import { useFlashOnChange } from "@/hooks/useFlashOnChange";
import type { TrendingToken } from "@/lib/stacks";

const COINGECKO_STACKS_URL = "https://www.coingecko.com/en/categories/stacks-ecosystem";

const Sparkline = memo(function Sparkline({ prices, isPositive }: { prices: number[]; isPositive: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (prices.length < 2) {
    return <div className="w-20 h-10" />;
  }

  const w = 80;
  const h = 40;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const coords = prices.map((p, i) => ({
    x: (i / (prices.length - 1)) * w,
    y: h - ((p - min) / range) * (h - 4) - 2,
  }));
  const pts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`);

  const strokeColor = isPositive ? "#22c55e" : "#ef4444";

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.round((relX / w) * (prices.length - 1));
    const clamped = Math.max(0, Math.min(prices.length - 1, idx));
    setHoverIdx(clamped);
  }

  const hover = hoverIdx !== null ? { ...coords[hoverIdx], price: prices[hoverIdx] } : null;

  return (
    <div className="relative w-20 h-10">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="w-20 h-10 cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover && (
          <>
            <line
              x1={hover.x}
              y1={0}
              x2={hover.x}
              y2={h}
              stroke={strokeColor}
              strokeWidth="0.5"
              strokeDasharray="2 2"
              opacity={0.6}
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r={2.2}
              fill={strokeColor}
              stroke="var(--bg-card)"
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute -top-7 text-[10px] font-data font-semibold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap z-10"
          style={{
            left: `${(hover.x / w) * 100}%`,
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          {formatPrice(hover.price)}
        </div>
      )}
    </div>
  );
});

function formatPrice(price: number): string {
  if (price === 0) return "—";
  if (price >= 1000) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.001) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

const TokenRow = memo(function TokenRow({ token }: { token: TrendingToken }) {
  const isPositive = token.change24h >= 0;
  const priceFlash = useFlashOnChange(token.priceUsd);

  return (
    <a
      href={`https://www.coingecko.com/en/coins/${token.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 rounded-xl px-2 -mx-2 transition-colors cursor-pointer"
      style={{ ['--hover-bg' as string]: 'var(--bg-elevated)' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {/* Avatar */}
      <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        {token.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={token.image} alt={token.symbol} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xs font-bold text-gray-500">{token.symbol.slice(0, 3)}</span>
          </div>
        )}
      </div>

      {/* Name + symbol */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{token.name}</p>
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{token.symbol}</p>
      </div>

      {/* Sparkline */}
      <div className="flex-shrink-0">
        <Sparkline prices={token.sparkline} isPositive={isPositive} />
      </div>

      {/* Price + change */}
      <div className="text-right flex-shrink-0 w-24">
        <p className={`text-sm font-semibold ${priceFlash}`} style={{ color: 'var(--text-primary)' }}>{formatPrice(token.priceUsd)}</p>
        <div
          className={`flex items-center justify-end gap-0.5 mt-0.5 text-xs font-medium ${
            isPositive ? "text-green-500" : "text-red-500"
          }`}
        >
          <span
            className="inline-block"
            style={{
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              ...(isPositive
                ? { borderBottom: `5px solid currentColor` }
                : { borderTop: `5px solid currentColor` }),
            }}
          />
          <span>{Math.abs(token.change24h).toFixed(3)}%</span>
        </div>
      </div>
    </a>
  );
});

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-2">
      <div className="w-11 h-11 rounded-full shrink-0 skeleton" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 rounded w-24 skeleton" />
        <div className="h-3 rounded w-12 skeleton" />
      </div>
      <div className="w-20 h-10 rounded shrink-0 skeleton" />
      <div className="w-24 space-y-1.5 text-right">
        <div className="h-3 rounded w-16 ml-auto skeleton" />
        <div className="h-3 rounded w-12 ml-auto skeleton" />
      </div>
    </div>
  );
}

export default function TrendingTokens() {
  const { data: tokens, isLoading } = useTrendingTokens();

  return (
    <div
      className="glass-card rounded-2xl p-5 shadow-sm"
      style={{ ['--card-accent' as string]: '#FB7185' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Trending</h2>
          <Info size={13} style={{ color: 'var(--text-muted)' }} />
        </div>
        <a
          href={COINGECKO_STACKS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-0.5 text-sm transition-colors font-medium"
          style={{ color: 'var(--accent)' }}
        >
          See all <ChevronRight size={15} />
        </a>
      </div>

      {/* Token rows */}
      <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {isLoading
          ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
          : (tokens ?? []).slice(0, 5).map((token) => <TokenRow key={token.id} token={token} />)}
      </div>
    </div>
  );
}
