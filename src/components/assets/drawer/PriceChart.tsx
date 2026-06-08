"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { useTokenPriceHistory } from "@/hooks/useMarketData";
import { useThemeStore } from "@/store/themeStore";

const CHART_RANGES = [
  { key: "24h", label: "24h", days: 1 },
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
] as const;
type ChartRangeKey = (typeof CHART_RANGES)[number]["key"];

export default function PriceChart({ geckoId, symbol }: { geckoId: string; symbol: string }) {
  const t = useTranslations("assets.drawer.chart");
  const isDark = useThemeStore((s) => s.theme === "dark");
  const [rangeKey, setRangeKey] = useState<ChartRangeKey>("7d");
  const days = CHART_RANGES.find((r) => r.key === rangeKey)!.days;
  const { data, isLoading } = useTokenPriceHistory(geckoId, days);

  const { chartData, isPositive, color } = useMemo(() => {
    const rows = (data ?? []).map((p) => ({
      t: p.t,
      price: p.price,
      label:
        days === 1
          ? new Date(p.t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : new Date(p.t).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
    const up = rows.length >= 2 ? rows[rows.length - 1].price >= rows[0].price : true;
    const c = up ? (isDark ? "#00E5A0" : "#00C27A") : isDark ? "#F87171" : "#EF4444";
    return { chartData: rows, isPositive: up, color: c };
  }, [data, isDark, days]);

  const rangeTabs = (
    <div
      className="inline-flex rounded-lg p-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: "var(--bg-elevated)" }}
      role="tablist"
      aria-label={t("rangeAria")}
    >
      {CHART_RANGES.map((r) => {
        const active = r.key === rangeKey;
        return (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setRangeKey(r.key)}
            className="px-2 py-1 rounded-md transition-colors"
            style={{
              backgroundColor: active ? "var(--bg-card)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-muted)",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );

  if (!data && isLoading) {
    return (
      <div>
        <div className="flex justify-end mb-2">{rangeTabs}</div>
        <div
          className="h-32 rounded-xl animate-pulse"
          style={{ backgroundColor: "var(--border-subtle)" }}
          aria-hidden
        />
      </div>
    );
  }

  if (chartData.length < 2) {
    return (
      <div>
        <div className="flex justify-end mb-2">{rangeTabs}</div>
        <div
          className="h-32 rounded-xl flex items-center justify-center text-xs"
          style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}
        >
          {t("unavailable")}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-2">{rangeTabs}</div>
      <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`tokGrad-${geckoId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: isDark ? "var(--bg-elevated)" : "#fff",
              border: `1px solid ${isDark ? "var(--border-default)" : "#E2EAF4"}`,
              borderRadius: "10px",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: isDark ? "#DDE8F8" : "#0A1628",
              boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
            }}
            formatter={(v: unknown) => [`$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 6 })}`, symbol]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#tokGrad-${geckoId})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: color }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
        <p
          className="text-[10px] mt-1 text-right"
          style={{ color: "var(--text-muted)" }}
        >
          {t("via", { range: rangeKey, arrow: isPositive ? "▲" : "▼" })}
        </p>
      </div>
    </div>
  );
}
