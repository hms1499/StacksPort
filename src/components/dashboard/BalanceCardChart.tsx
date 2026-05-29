"use client";

import { useEffect, useRef, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { formatUSD } from "@/lib/utils";

type ChartPoint = { date: string; value: number };

// Split out of BalanceCard so Recharts (~150kb) loads as its own chunk via
// next/dynamic instead of bloating the eager dashboard render path.
//
// We measure the wrapper ourselves and render the chart with explicit pixel
// dimensions only once they are positive. ResponsiveContainer renders its
// child with a -1 sentinel size on first paint (before its ResizeObserver
// fires), which makes Recharts log "width(-1) height(-1)" warnings.
export default function BalanceCardChart({
  chartData,
  isConnected,
  isDark,
}: {
  chartData: ChartPoint[];
  isConnected: boolean;
  isDark: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full h-full">
      {size.w > 0 && size.h > 0 && (
        <AreaChart
          width={size.w}
          height={size.h}
          data={chartData}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDark ? "#00E5A0" : "#00C27A"} stopOpacity={0.25} />
              <stop offset="100%" stopColor={isDark ? "#00E5A0" : "#00C27A"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: isDark ? "#2A4060" : "#8AA0BE", fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={["auto", "auto"]} />
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
            formatter={(v: unknown) => [
              isConnected ? formatUSD(Number(v)) : `$${Number(v).toFixed(4)}`,
              isConnected ? "Portfolio" : "STX Price",
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={isDark ? "#00E5A0" : "#00C27A"}
            strokeWidth={1.5}
            fill="url(#balanceGrad)"
            dot={false}
          />
        </AreaChart>
      )}
    </div>
  );
}
