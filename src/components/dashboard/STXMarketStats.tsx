"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { getSTXMarketStats, getSTXMarketHistory, STXMarketStats } from "@/lib/stacks";

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function Sparkline({ prices, isPositive }: { prices: number[]; isPositive: boolean }) {
  if (prices.length < 2) return <div className="w-full h-12" />;

  const w = 200;
  const h = 48;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const strokeColor = isPositive ? "#22c55e" : "#ef4444";
  const fillColor = isPositive ? "#22c55e" : "#ef4444";
  const last = pts[pts.length - 1].split(",");
  const first = pts[0].split(",");
  const fillPath = `M ${pts.join(" L ")} L ${last[0]},${h} L ${first[0]},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sparkGrad-${strokeColor.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity={0.15} />
          <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#sparkGrad-${strokeColor.slice(1)})`} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="h-3 bg-gray-100 rounded animate-pulse w-16" />
      <div className="h-6 bg-gray-100 rounded animate-pulse mt-2 w-24" />
      <div className="h-12 bg-gray-50 rounded-lg animate-pulse mt-3" />
    </div>
  );
}

export default function STXMarketStatsCard() {
  const [stats, setStats] = useState<STXMarketStats | null>(null);
  const [history, setHistory] = useState<{ prices: number[]; marketCaps: number[]; volumes: number[] }>({
    prices: [],
    marketCaps: [],
    volumes: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSTXMarketStats(), getSTXMarketHistory(7)])
      .then(([s, h]) => {
        setStats(s);
        setHistory(h);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const isPositive = (stats?.change24h ?? 0) >= 0;

  // Volume trend: compare last vs first
  const volIsPositive =
    history.volumes.length >= 2
      ? history.volumes[history.volumes.length - 1] >= history.volumes[0]
      : true;

  // Market cap trend
  const mcapIsPositive =
    history.marketCaps.length >= 2
      ? history.marketCaps[history.marketCaps.length - 1] >= history.marketCaps[0]
      : true;

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* STX Price */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p className="text-xs text-gray-400 font-medium">STX Price</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className="text-lg font-bold text-gray-900">
            {stats ? `$${stats.price.toFixed(4)}` : "—"}
          </p>
          {stats && (
            <span
              className={`flex items-center gap-0.5 text-xs font-medium ${
                isPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(stats.change24h).toFixed(2)}%
            </span>
          )}
        </div>
        <div className="mt-2">
          <Sparkline prices={history.prices} isPositive={isPositive} />
        </div>
      </div>

      {/* Market Cap */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p className="text-xs text-gray-400 font-medium">Market Cap</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className="text-lg font-bold text-gray-900">
            {stats ? formatLargeNumber(stats.marketCap) : "—"}
          </p>
          {history.marketCaps.length >= 2 && (
            <span
              className={`flex items-center gap-0.5 text-xs font-medium ${
                mcapIsPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {mcapIsPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            </span>
          )}
        </div>
        <div className="mt-2">
          <Sparkline prices={history.marketCaps} isPositive={mcapIsPositive} />
        </div>
      </div>

      {/* Volume 24h */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p className="text-xs text-gray-400 font-medium">Volume 24h</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className="text-lg font-bold text-gray-900">
            {stats ? formatLargeNumber(stats.volume24h) : "—"}
          </p>
          {history.volumes.length >= 2 && (
            <span
              className={`flex items-center gap-0.5 text-xs font-medium ${
                volIsPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {volIsPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            </span>
          )}
        </div>
        <div className="mt-2">
          <Sparkline prices={history.volumes} isPositive={volIsPositive} />
        </div>
      </div>
    </div>
  );
}
