"use client";

import { memo, useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useSTXMarketStats, useSTXMarketHistory } from "@/hooks/useMarketData";

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

const Sparkline = memo(function Sparkline({ prices, isPositive }: { prices: number[]; isPositive: boolean }) {
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
});

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-16" />
      <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mt-2 w-24" />
      <div className="h-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse mt-3" />
    </div>
  );
}

export default function STXMarketStatsCard() {
  const { data: stats, isLoading: statsLoading } = useSTXMarketStats();
  const { data: history, isLoading: historyLoading } = useSTXMarketHistory(7);

  const loading = statsLoading || historyLoading;
  const prices = useMemo(() => history?.prices ?? [], [history]);
  const marketCaps = useMemo(() => history?.marketCaps ?? [], [history]);
  const volumes = useMemo(() => history?.volumes ?? [], [history]);

  const isPositive = (stats?.change24h ?? 0) >= 0;
  const volIsPositive = useMemo(() => volumes.length >= 2 ? volumes[volumes.length - 1] >= volumes[0] : true, [volumes]);
  const mcapIsPositive = useMemo(() => marketCaps.length >= 2 ? marketCaps[marketCaps.length - 1] >= marketCaps[0] : true, [marketCaps]);

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {/* STX Price */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
        <p className="text-xs text-gray-400 font-medium">STX Price</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
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
          <Sparkline prices={prices} isPositive={isPositive} />
        </div>
      </div>

      {/* Market Cap */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
        <p className="text-xs text-gray-400 font-medium">Market Cap</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {stats ? formatLargeNumber(stats.marketCap) : "—"}
          </p>
          {marketCaps.length >= 2 && (
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
          <Sparkline prices={marketCaps} isPositive={mcapIsPositive} />
        </div>
      </div>

      {/* Volume 24h */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
        <p className="text-xs text-gray-400 font-medium">Volume 24h</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {stats ? formatLargeNumber(stats.volume24h) : "—"}
          </p>
          {volumes.length >= 2 && (
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
          <Sparkline prices={volumes} isPositive={volIsPositive} />
        </div>
      </div>
    </div>
  );
}
