"use client";

import { memo, useMemo } from "react";
import { TokenWithValue } from "@/lib/stacks";
import { formatUSD, formatPercent } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

const ALLOCATION_COLORS = [
  "#408A71", // brand green — STX
  "#6366f1", // indigo
  "#f97316", // orange
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#84cc16", // lime
  "#f59e0b", // amber
];

interface Props {
  stx: TokenWithValue | null;
  tokens: TokenWithValue[];
  totalUsd: number;
  loading: boolean;
}

const AllocationBar = memo(function AllocationBar({ stx, tokens, totalUsd }: Omit<Props, "loading">) {
  const segments = useMemo(() => {
    if (!stx || totalUsd === 0) return [];
    const allTokens = [stx, ...tokens.filter((t) => t.valueUsd > 0)];
    const topTokens = allTokens.slice(0, 7);
    const otherUsd = allTokens.slice(7).reduce((s, t) => s + t.valueUsd, 0);
    return [
      ...topTokens.map((t, i) => ({
        label: t.symbol,
        usd: t.valueUsd,
        pct: (t.valueUsd / totalUsd) * 100,
        color: ALLOCATION_COLORS[i],
      })),
      ...(otherUsd > 0
        ? [{ label: "Other", usd: otherUsd, pct: (otherUsd / totalUsd) * 100, color: "#d1d5db" }]
        : []),
    ];
  }, [stx, tokens, totalUsd]);

  if (segments.length === 0) return null;

  return (
    <div className="mt-5">
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${s.pct}%`, backgroundColor: s.color }}
            title={`${s.label}: ${s.pct.toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-gray-500 font-medium">{s.label}</span>
            <span className="text-gray-400">{s.pct.toFixed(1)}%</span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-500">{formatUSD(s.usd)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default function PortfolioSummary({ stx, tokens, totalUsd, loading }: Props) {
  const change24h = stx?.change24h ?? 0;
  const isPositive = change24h >= 0;

  if (!loading && !stx) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col items-center justify-center py-10 text-center">
        <Wallet size={36} className="text-gray-200 mb-3" />
        <p className="text-sm text-gray-400">Connect your wallet to view portfolio</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Net Worth</p>

      {loading ? (
        <div className="space-y-3 mt-2">
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse w-48" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-32" />
          <div className="h-2 bg-gray-100 rounded-full animate-pulse mt-5" />
          <div className="flex gap-4 mt-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-3 bg-gray-100 rounded animate-pulse w-24" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-4xl font-bold text-gray-900">{formatUSD(totalUsd)}</span>
            <span
              className={`flex items-center gap-1 text-sm font-medium ${
                isPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {formatPercent(change24h)}
              <span className="text-gray-400 font-normal text-xs ml-0.5">24h</span>
            </span>
          </div>

          <p className="text-sm text-gray-400 mt-0.5">
            {stx?.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} STX ·{" "}
            {[stx!, ...tokens].length} assets
          </p>

          <AllocationBar stx={stx} tokens={tokens} totalUsd={totalUsd} />
        </>
      )}
    </div>
  );
}
