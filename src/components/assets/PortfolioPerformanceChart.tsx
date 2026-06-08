"use client";

import { memo, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingDown, TrendingUp, LineChart as LineChartIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWalletStore } from "@/store/walletStore";
import { useThemeStore } from "@/store/themeStore";
import {
  usePortfolioHistorySnap,
  type PortfolioHistoryRange,
} from "@/hooks/useMarketData";
import { formatUSD, formatPercent } from "@/lib/utils";
import EmptyState from "@/components/motion/EmptyState";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";

type Period = "1D" | "1W" | "1M" | "All";

const PERIOD_TO_RANGE: Record<Period, PortfolioHistoryRange> = {
  "1D": "24h",
  "1W": "7d",
  "1M": "30d",
  All: "all",
};

const PERIODS: Period[] = ["1D", "1W", "1M", "All"];

function formatTick(t: number, range: PortfolioHistoryRange): string {
  const d = new Date(t);
  if (range === "24h") {
    return d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function PortfolioPerformanceChart() {
  const t = useTranslations("assets.perf");
  const { stxAddress, isConnected } = useWalletStore();
  const isDark = useThemeStore((s) => s.theme === "dark");
  const [period, setPeriod] = useState<Period>("1M");
  const periodLabel = period === "All" ? t("all") : period;

  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const range = PERIOD_TO_RANGE[period];
  const { data, isLoading } = usePortfolioHistorySnap(addr, range);

  const chartData = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        date: formatTick(p.t, range),
        value: p.totalUsd,
        t: p.t,
      })),
    [data, range]
  );

  const { changeUsd, changePct, isPositive, startValue } = useMemo(() => {
    if (chartData.length < 2) {
      return { changeUsd: null, changePct: null, isPositive: true, startValue: null };
    }
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    const usd = last - first;
    const pct = first === 0 ? null : (usd / first) * 100;
    return {
      changeUsd: usd,
      changePct: pct,
      isPositive: usd >= 0,
      startValue: first,
    };
  }, [chartData]);

  const accentColor = isPositive
    ? isDark
      ? "#00E5A0"
      : "#00C27A"
    : isDark
    ? "#F87171"
    : "#EF4444";

  if (!isConnected) {
    return (
      <div className="glass-card rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <LineChartIcon size={16} style={{ color: "var(--text-muted)" }} />
          <h3
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
          >
            {t("title")}
          </h3>
        </div>
        <EmptyState
          icon={<LineChartIcon size={32} />}
          title={t("connectTitle")}
          description={t("connectDesc")}
          action={<ConnectWalletCTA />}
        />
      </div>
    );
  }

  const firstSeenLabel = data?.firstSeenAt
    ? t("trackingSince", {
        date: new Date(data.firstSeenAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      })
    : null;

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <LineChartIcon size={16} style={{ color: "var(--text-muted)" }} />
          <h3
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
          >
            {t("title")}
          </h3>
        </div>

        <div
          className="flex gap-0.5 p-0.5 rounded-lg"
          style={{ backgroundColor: "var(--border-subtle)" }}
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-150"
              style={
                period === p
                  ? {
                      backgroundColor: "var(--bg-card)",
                      color: "var(--text-primary)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }
                  : { color: "var(--text-muted)" }
              }
              aria-pressed={period === p}
            >
              {p === "All" ? t("all") : p}
            </button>
          ))}
        </div>
      </div>

      {/* Period delta */}
      <div className="mb-4">
        {changeUsd !== null && changePct !== null ? (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="text-2xl font-bold font-data"
              style={{ color: accentColor }}
            >
              {isPositive ? "+" : "−"}
              {formatUSD(Math.abs(changeUsd))}
            </span>
            <span
              className="flex items-center gap-1 text-sm font-semibold font-data px-2 py-0.5 rounded-lg"
              style={{
                color: accentColor,
                backgroundColor: isDark
                  ? isPositive
                    ? "rgba(0, 229, 160, 0.1)"
                    : "rgba(248, 113, 113, 0.12)"
                  : isPositive
                  ? "rgba(0, 194, 122, 0.1)"
                  : "rgba(239, 68, 68, 0.1)",
              }}
            >
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {formatPercent(changePct)}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {t("over", { period: periodLabel })}
            </span>
          </div>
        ) : (
          <div
            className="h-7 w-48 rounded skeleton"
            aria-hidden
            style={{ opacity: isLoading ? 1 : 0.5 }}
          />
        )}
      </div>

      {/* Chart */}
      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#1a2a40" : "#E8EEF7"}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{
                fontSize: 10,
                fill: isDark ? "#5A7090" : "#8AA0BE",
                fontFamily: "var(--font-mono)",
              }}
              axisLine={false}
              tickLine={false}
              minTickGap={32}
            />
            <YAxis
              tick={{
                fontSize: 10,
                fill: isDark ? "#5A7090" : "#8AA0BE",
                fontFamily: "var(--font-mono)",
              }}
              axisLine={false}
              tickLine={false}
              width={64}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) =>
                v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`
              }
            />
            {startValue !== null && (
              <ReferenceLine
                y={startValue}
                stroke={isDark ? "#3A5078" : "#B8C5D8"}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            <Tooltip
              contentStyle={{
                background: isDark ? "var(--bg-elevated)" : "#fff",
                border: `1px solid ${isDark ? "var(--border-default)" : "#E2EAF4"}`,
                borderRadius: "12px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: isDark ? "#DDE8F8" : "#0A1628",
                boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              }}
              formatter={(v: unknown) => [formatUSD(Number(v)), t("tooltipPortfolio")]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={accentColor}
              strokeWidth={2}
              fill="url(#perfGrad)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: accentColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div
          className="h-65 rounded-xl flex items-center justify-center px-6 text-center"
          style={{ backgroundColor: "var(--border-subtle)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isLoading ? t("loading") : t("notEnough")}
          </span>
        </div>
      )}

      {firstSeenLabel && (
        <p
          className="mt-3 text-[10px] uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          {firstSeenLabel}
        </p>
      )}
    </div>
  );
}

export default memo(PortfolioPerformanceChart);
