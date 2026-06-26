"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useSTXMarketStats, useSTXMarketHistory } from "@/hooks/useMarketData";
import { useFlashOnChange } from "@/hooks/useFlashOnChange";
import PriceSparkline from "@/components/dashboard/PriceSparkline";

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

const Sparkline = ({ prices, isPositive }: { prices: number[]; isPositive: boolean }) => (
  <PriceSparkline
    prices={prices}
    isPositive={isPositive}
    fill
    width={200}
    height={48}
    padY={6}
    className="w-full h-12"
  />
);

function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl p-4 shadow-sm">
      <div className="h-3 w-16 rounded skeleton" />
      <div className="h-6 w-24 rounded mt-2 skeleton" />
      <div className="h-12 rounded-lg mt-3 skeleton" />
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
  const priceFlash = useFlashOnChange(stats?.price);
  const mcapFlash  = useFlashOnChange(stats?.marketCap);
  const volFlash   = useFlashOnChange(stats?.volume24h);
  const volIsPositive = useMemo(() => volumes.length >= 2 ? volumes[volumes.length - 1] >= volumes[0] : true, [volumes]);
  const mcapIsPositive = useMemo(() => marketCaps.length >= 2 ? marketCaps[marketCaps.length - 1] >= marketCaps[0] : true, [marketCaps]);

  const mcapPct = useMemo(() => {
    if (marketCaps.length < 2 || marketCaps[0] === 0) return null;
    return ((marketCaps[marketCaps.length - 1] - marketCaps[0]) / marketCaps[0]) * 100;
  }, [marketCaps]);

  const volPct = useMemo(() => {
    if (volumes.length < 2 || volumes[0] === 0) return null;
    return ((volumes[volumes.length - 1] - volumes[0]) / volumes[0]) * 100;
  }, [volumes]);

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
      <div className="glass-card rounded-2xl p-4 shadow-sm">
        <p className="font-data text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>STX Price</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className={`font-data text-lg font-bold ${priceFlash}`} style={{ color: 'var(--text-primary)' }}>
            {stats ? `$${stats.price.toFixed(4)}` : "—"}
          </p>
          {stats && (
            <span
              className={`font-data flex items-center gap-0.5 text-xs font-medium ${
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
      <div className="glass-card rounded-2xl p-4 shadow-sm">
        <p className="font-data text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>Market Cap</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className={`font-data text-lg font-bold ${mcapFlash}`} style={{ color: 'var(--text-primary)' }}>
            {stats ? formatLargeNumber(stats.marketCap) : "—"}
          </p>
          {mcapPct !== null && (
            <span
              className={`font-data flex items-center gap-0.5 text-xs font-medium ${
                mcapIsPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {mcapIsPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(mcapPct).toFixed(2)}%
            </span>
          )}
        </div>
        <div className="mt-2">
          <Sparkline prices={marketCaps} isPositive={mcapIsPositive} />
        </div>
      </div>

      {/* Volume 24h */}
      <div className="glass-card rounded-2xl p-4 shadow-sm">
        <p className="font-data text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>Volume 24h</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className="font-data text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            <span className={volFlash}>{stats ? formatLargeNumber(stats.volume24h) : "—"}</span>
          </p>
          {volPct !== null && (
            <span
              className={`font-data flex items-center gap-0.5 text-xs font-medium ${
                volIsPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {volIsPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(volPct).toFixed(2)}%
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
