"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SBTCPlanPerformance } from "@/lib/dca-sbtc";
import { getHistoricalStxBtcRange } from "@/lib/stacks";

interface PlanWithPerf {
  perf: SBTCPlanPerformance;
}

interface ChartPoint {
  date: string;            // YYYY-MM-DD
  basis: number;           // running cumulative USDCx per sBTC up to this date
  spot: number | null;     // BTC/USD (USDCx ≈ $1 → BTC/USD ≈ USDCx/sBTC) on this date
}

interface Props {
  perPlan: PlanWithPerf[];
}

// USDCx is the only Out target token in production; mirrors the rationale used
// by the rest of the Out work. Whole-token math below assumes 6 decimals.
const TOKEN_LABEL = "USDCx";
const TOKEN_DECIMALS = 6;

// CoinGecko free-tier ceiling. If a user's first execution is older we trim the
// chart at this window rather than spawn N /history calls.
const MAX_CHART_DAYS = 90;

function utcDayKey(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00Z").getTime();
  const b = new Date(toISO + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

function* dateRange(fromISO: string, toISO: string): Generator<string> {
  const start = new Date(fromISO + "T00:00:00Z");
  const end = new Date(toISO + "T00:00:00Z");
  const cur = new Date(start);
  while (cur <= end) {
    yield cur.toISOString().slice(0, 10);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

export default function CostBasisOutChart({ perPlan }: Props) {
  const sortedEvents = useMemo(() => {
    return perPlan
      .flatMap((p) => p.perf.successfulEvents)
      .filter((e) => (e.blockTime ?? 0) > 0 && (e.sbtcIn ?? 0) > 0 && (e.tokenOut ?? 0) > 0)
      .sort((a, b) => (a.blockTime ?? 0) - (b.blockTime ?? 0));
  }, [perPlan]);

  const dailyDelta = useMemo(() => {
    const m = new Map<string, { sbtcIn: number; tokenOut: number }>();
    for (const e of sortedEvents) {
      const day = utcDayKey(e.blockTime!);
      const cur = m.get(day) ?? { sbtcIn: 0, tokenOut: 0 };
      cur.sbtcIn += (e.sbtcIn ?? 0) / 1e8;
      cur.tokenOut += (e.tokenOut ?? 0) / Math.pow(10, TOKEN_DECIMALS);
      m.set(day, cur);
    }
    return m;
  }, [sortedEvents]);

  const firstDate = sortedEvents.length > 0 ? utcDayKey(sortedEvents[0].blockTime!) : null;
  const todayISO = new Date().toISOString().slice(0, 10);

  const requestDays = firstDate
    ? Math.min(MAX_CHART_DAYS, Math.max(7, daysBetween(firstDate, todayISO) + 1))
    : 0;

  const [pricesByDate, setPricesByDate] = useState<Map<string, { stxUsd: number; btcUsd: number }> | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesFailed, setPricesFailed] = useState(false);

  useEffect(() => {
    if (requestDays === 0) {
      setPricesByDate(null);
      return;
    }
    let cancelled = false;
    setPricesLoading(true);
    setPricesFailed(false);
    getHistoricalStxBtcRange(requestDays)
      .then((m) => {
        if (cancelled) return;
        if (m.size === 0) setPricesFailed(true);
        setPricesByDate(m);
      })
      .finally(() => {
        if (!cancelled) setPricesLoading(false);
      });
    return () => { cancelled = true; };
  }, [requestDays]);

  const data = useMemo<ChartPoint[]>(() => {
    if (!firstDate || !pricesByDate) return [];
    const windowStart = (() => {
      const cap = new Date();
      cap.setUTCDate(cap.getUTCDate() - (MAX_CHART_DAYS - 1));
      const capISO = cap.toISOString().slice(0, 10);
      return firstDate < capISO ? capISO : firstDate;
    })();

    let sbtcIn = 0;
    let tokenOut = 0;
    for (const e of sortedEvents) {
      const day = utcDayKey(e.blockTime!);
      if (day < windowStart) {
        sbtcIn += (e.sbtcIn ?? 0) / 1e8;
        tokenOut += (e.tokenOut ?? 0) / Math.pow(10, TOKEN_DECIMALS);
      }
    }

    const out: ChartPoint[] = [];
    for (const day of dateRange(windowStart, todayISO)) {
      const delta = dailyDelta.get(day);
      if (delta) {
        sbtcIn += delta.sbtcIn;
        tokenOut += delta.tokenOut;
      }
      const basis = sbtcIn > 0 ? tokenOut / sbtcIn : 0;
      const price = pricesByDate.get(day);
      // USDCx pegged to $1 — BTC/USD ≈ USDCx per sBTC.
      const spot = price ? price.btcUsd : null;
      if (basis === 0 && out.length === 0) continue;
      out.push({ date: day, basis, spot });
    }
    return out;
  }, [firstDate, todayISO, sortedEvents, dailyDelta, pricesByDate]);

  // Guard on distinct UTC days, not raw event count: multiple executions in
  // the same day collapse to one bucket and would render an invisible chart.
  if (dailyDelta.size < 2) {
    return (
      <ChartShell>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Need at least 2 executions on different days for a meaningful sell-rate chart.
        </p>
      </ChartShell>
    );
  }

  if (pricesLoading) {
    return (
      <ChartShell>
        <div className="h-56 rounded-xl skeleton" />
      </ChartShell>
    );
  }

  if (pricesFailed || data.length === 0) {
    return (
      <ChartShell>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Historical BTC prices unavailable — chart can&apos;t be drawn.
        </p>
      </ChartShell>
    );
  }

  return (
    <ChartShell>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
              tickFormatter={(d: string) =>
                new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
              }
              minTickGap={24}
              stroke="var(--border-subtle)"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
              tickFormatter={(v: number) => Math.round(v).toLocaleString()}
              width={56}
              stroke="var(--border-subtle)"
              domain={["auto", "auto"]}
            />
            <Tooltip content={<SellRateTooltip />} />
            <Line
              type="monotone"
              dataKey="spot"
              name="Spot"
              stroke="var(--text-muted)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="basis"
              name="Your avg sell rate"
              stroke="#00C27A"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10px] flex-wrap" style={{ color: "var(--text-muted)" }}>
        <LegendDot color="#00C27A" label={`Your running avg sell rate (${TOKEN_LABEL} per sBTC)`} />
        <LegendDot color="var(--text-muted)" label={`Spot ${TOKEN_LABEL}/sBTC`} dashed />
      </div>
    </ChartShell>
  );
}

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={14} style={{ color: "#00C27A" }} />
        <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
          Sell rate over time
        </h2>
        <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
          last {MAX_CHART_DAYS} days
        </span>
      </div>
      {children}
    </div>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block"
        style={{
          width: 14,
          height: 0,
          borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}`,
        }}
      />
      {label}
    </span>
  );
}

interface TooltipPayload {
  payload: ChartPoint;
}

function SellRateTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload || payload.length === 0 || !label) return null;
  const p = payload[0].payload;
  return (
    <div
      className="rounded-lg px-2.5 py-2 text-[11px]"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-card)",
        color: "var(--text-primary)",
      }}
    >
      <div className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
        {new Date(label + "T00:00:00Z").toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })}
      </div>
      <div className="flex items-center justify-between gap-3 font-data">
        <span style={{ color: "#00C27A" }}>Your avg</span>
        <span>{Math.round(p.basis).toLocaleString()} {TOKEN_LABEL}</span>
      </div>
      <div className="flex items-center justify-between gap-3 font-data">
        <span style={{ color: "var(--text-muted)" }}>Spot</span>
        <span>{p.spot != null ? `${Math.round(p.spot).toLocaleString()} ${TOKEN_LABEL}` : "—"}</span>
      </div>
    </div>
  );
}
