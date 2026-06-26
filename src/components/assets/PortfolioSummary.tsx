"use client";

import { memo, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { TokenWithValue } from "@/lib/stacks";
import { formatUSD, formatPercent } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import EmptyState from "@/components/motion/EmptyState";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";
import AnimatedCounter from "@/components/motion/AnimatedCounter";
import { useWalletStore } from "@/store/walletStore";
import {
  usePortfolioHistorySnap,
  type PortfolioHistoryPoint,
} from "@/hooks/useMarketData";

// Tiny inline sparkline. Recharts would be overkill in a header that
// remounts on every tab switch; a plain <path> is cheaper.
function Sparkline({
  points,
  color,
}: {
  points: PortfolioHistoryPoint[];
  color: string;
}) {
  const path = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.totalUsd);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const w = 64;
    const h = 20;
    const step = w / (points.length - 1);
    return points
      .map((p, i) => {
        const x = i * step;
        const y = h - ((p.totalUsd - min) / span) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points]);

  if (!path) return null;

  return (
    <svg width={64} height={20} className="shrink-0" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  const t = useTranslations("assets.summary");
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
        ? [{ label: t("other"), usd: otherUsd, pct: (otherUsd / totalUsd) * 100, color: ALLOCATION_COLORS[7] }]
        : []),
    ];
  }, [stx, tokens, totalUsd, t]);

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
              <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fill: 'var(--text-primary)' }} fontSize={12} fontWeight={600}>
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
            <span className="font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            <span className="font-data ml-auto" style={{ color: 'var(--text-muted)' }}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default function PortfolioSummary({ stx, tokens, totalUsd, loading }: Props) {
  const t = useTranslations("assets.summary");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: history } = usePortfolioHistorySnap(addr, "24h");

  // Real portfolio 24h delta when we have ≥2 points; otherwise fall back to
  // STX's 24h change (still useful — STX dominates most users' net worth).
  const points = history?.points ?? [];
  const hasRealDelta = points.length >= 2;
  const change24h = hasRealDelta
    ? (() => {
        const first = points[0].totalUsd;
        const last = points[points.length - 1].totalUsd;
        return first === 0 ? 0 : ((last - first) / first) * 100;
      })()
    : stx?.change24h ?? 0;
  const isPositive = change24h >= 0;
  const sparkColor = isPositive ? "#10b981" : "#ef4444";

  if (!loading && !stx) {
    return (
      <div className="glass-card rounded-2xl shadow-sm">
        <EmptyState
          icon={<Wallet size={28} style={{ color: 'var(--accent)' }} />}
          title={t("connectTitle")}
          description={t("connectDesc")}
          action={<ConnectWalletCTA />}
        />
      </div>
    );
  }

  const sk = { backgroundColor: 'var(--border-subtle)' } as const;

  return (
    <div className="glass-card rounded-2xl p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t("netWorth")}</p>

      {loading ? (
        <div className="space-y-3 mt-2 animate-pulse">
          <div className="h-10 rounded-lg w-48" style={sk} />
          <div className="h-3 rounded w-32" style={sk} />
          <div className="flex items-center gap-4 mt-5">
            <div className="w-35 h-35 rounded-full" style={sk} />
            <div className="flex-1 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-3 rounded w-32" style={sk} />
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
              className="font-data text-4xl font-bold"
              style={{ color: 'var(--text-primary)' }}
            />
            <span
              className={`flex items-center gap-1 text-sm font-medium ${
                isPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span className="font-data">{formatPercent(change24h)}</span>
              <span
                className="font-normal text-xs ml-0.5"
                style={{ color: 'var(--text-muted)' }}
                title={hasRealDelta ? t("portfolio24h") : t("stx24h")}
              >
                {t("h24")}
              </span>
            </span>
            {hasRealDelta && <Sparkline points={points} color={sparkColor} />}
          </div>

          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t("assetsLine", {
              balance: stx?.balance.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "0",
              count: [stx!, ...tokens].length,
            })}
          </p>

          <AllocationDonut stx={stx} tokens={tokens} totalUsd={totalUsd} />
        </>
      )}
    </div>
  );
}
