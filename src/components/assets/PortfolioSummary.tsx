"use client";

import { memo, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { TokenWithValue } from "@/lib/stacks";
import { formatUSD, formatPercent } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import EmptyState from "@/components/motion/EmptyState";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";
import AnimatedCounter from "@/components/motion/AnimatedCounter";

const ALLOCATION_COLORS = [
  "#408A71", // brand green — STX
  "#6366f1", // indigo
  "#f97316", // orange
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#84cc16", // lime
  "#f59e0b", // amber
  "#d1d5db", // gray — other
];

interface Props {
  stx: TokenWithValue | null;
  tokens: TokenWithValue[];
  totalUsd: number;
  loading: boolean;
}

const AllocationDonut = memo(function AllocationDonut({ stx, tokens, totalUsd }: Omit<Props, "loading">) {
  const [activeIndex, setActiveIndex] = useState(-1);

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
        ? [{ label: "Other", usd: otherUsd, pct: (otherUsd / totalUsd) * 100, color: ALLOCATION_COLORS[7] }]
        : []),
    ];
  }, [stx, tokens, totalUsd]);

  if (segments.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
      {/* Donut chart */}
      <div className="w-35 h-35 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              dataKey="usd"
              nameKey="label"
              strokeWidth={2}
              stroke="transparent"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(-1)}
            >
              {segments.map((s, i) => (
                <Cell key={s.label} fill={s.color} opacity={activeIndex >= 0 && activeIndex !== i ? 0.4 : 1} />
              ))}
            </Pie>
            {/* Center label */}
            {activeIndex >= 0 && segments[activeIndex] && (
              <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-gray-900 dark:fill-gray-100" fontSize={12} fontWeight={600}>
                {segments[activeIndex].label}
              </text>
            )}
            {activeIndex >= 0 && segments[activeIndex] && (
              <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-gray-400" fontSize={10}>
                {segments[activeIndex].pct.toFixed(1)}%
              </text>
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 min-w-0">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className={`flex items-center gap-2 text-xs cursor-default transition-opacity ${
              activeIndex >= 0 && activeIndex !== i ? "opacity-40" : ""
            }`}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(-1)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-gray-600 dark:text-gray-300 font-medium truncate">{s.label}</span>
            <span className="text-gray-400 dark:text-gray-500 ml-auto">{s.pct.toFixed(1)}%</span>
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
      <div className="glass-card rounded-2xl shadow-sm">
        <EmptyState
          icon={<Wallet size={28} style={{ color: 'var(--accent)' }} />}
          title="Portfolio overview"
          description="Connect your wallet to view your net worth and asset allocation."
          action={<ConnectWalletCTA />}
        />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">Net Worth</p>

      {loading ? (
        <div className="space-y-3 mt-2">
          <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse w-48" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-32" />
          <div className="flex items-center gap-4 mt-5">
            <div className="w-35 h-35 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
            <div className="flex-1 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-32" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mt-1">
            <AnimatedCounter
              value={totalUsd}
              formatFn={formatUSD}
              className="text-4xl font-bold text-gray-900 dark:text-gray-100"
            />
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

          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            {stx?.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} STX ·{" "}
            {[stx!, ...tokens].length} assets
          </p>

          <AllocationDonut stx={stx} tokens={tokens} totalUsd={totalUsd} />
        </>
      )}
    </div>
  );
}
