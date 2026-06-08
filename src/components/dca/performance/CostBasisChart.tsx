"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
import type { PlanPerformance } from "@/lib/dca";
import { getHistoricalStxBtcRange } from "@/lib/stacks";

interface PlanWithPerf {
  perf: PlanPerformance;
}

interface ChartPoint {
  date: string;       // YYYY-MM-DD
  basis: number;      // running avg STX per sBTC up to this date
  spot: number | null; // spot STX per sBTC on this date (BTC_USD / STX_USD)
}

interface Props {
  perPlan: PlanWithPerf[];
}

// CoinGecko free-tier ceiling. If a user's first execution is older we
// trim the chart at this window rather than spawn N /history calls.
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

export default function CostBasisChart({ perPlan }: Props) {
  const tr = useTranslations("dca.perf.chart");
  // Flatten every successful execution across every plan into one timeline.
  // Sorted by blockTime so the cumulative cost basis walks forward in time.
  const sortedEvents = useMemo(() => {
    return perPlan
      .flatMap((p) => p.perf.successfulEvents)
      .filter((e) => (e.blockTime ?? 0) > 0 && (e.sbtcReceived ?? 0) > 0 && (e.netSwapped ?? 0) > 0)
      .sort((a, b) => (a.blockTime ?? 0) - (b.blockTime ?? 0));
  }, [perPlan]);

  // Per-day deltas: how much STX in and sBTC out the user transacted that day.
  // Multiple plans executing the same day collapse into one bucket.
  const dailyDelta = useMemo(() => {
    const m = new Map<string, { stxIn: number; sbtcOut: number }>();
    for (const e of sortedEvents) {
      const day = utcDayKey(e.blockTime!);
      const cur = m.get(day) ?? { stxIn: 0, sbtcOut: 0 };
      // netSwapped is micro-STX, sbtcReceived is sats. Convert to whole units
      // so the resulting ratio is STX per sBTC (matches avgStxPerSbtc).
      cur.stxIn += (e.netSwapped ?? 0) / 1_000_000;
      cur.sbtcOut += (e.sbtcReceived ?? 0) / 100_000_000;
      m.set(day, cur);
    }
    return m;
  }, [sortedEvents]);

  const firstDate = sortedEvents.length > 0 ? utcDayKey(sortedEvents[0].blockTime!) : null;
  const todayISO = new Date().toISOString().slice(0, 10);

  // Always fetch enough range to cover from first execution to today, capped
  // at MAX_CHART_DAYS. CoinGecko returns up to that many days in two calls.
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

  // Walk every day in the window once; running totals carry forward across
  // gap days so the basis line stays flat between executions instead of
  // disappearing.
  const data = useMemo<ChartPoint[]>(() => {
    if (!firstDate || !pricesByDate) return [];
    // If the user's first execution is older than MAX_CHART_DAYS, anchor the
    // window at today - MAX_CHART_DAYS but seed the running totals with all
    // executions prior to the window so the basis line starts at the right
    // level instead of 0.
    const windowStart = (() => {
      const cap = new Date();
      cap.setUTCDate(cap.getUTCDate() - (MAX_CHART_DAYS - 1));
      const capISO = cap.toISOString().slice(0, 10);
      return firstDate < capISO ? capISO : firstDate;
    })();

    let stxIn = 0;
    let sbtcOut = 0;
    for (const e of sortedEvents) {
      const day = utcDayKey(e.blockTime!);
      if (day < windowStart) {
        stxIn += (e.netSwapped ?? 0) / 1_000_000;
        sbtcOut += (e.sbtcReceived ?? 0) / 100_000_000;
      }
    }

    const out: ChartPoint[] = [];
    for (const day of dateRange(windowStart, todayISO)) {
      const delta = dailyDelta.get(day);
      if (delta) {
        stxIn += delta.stxIn;
        sbtcOut += delta.sbtcOut;
      }
      const basis = sbtcOut > 0 ? stxIn / sbtcOut : 0;
      const price = pricesByDate.get(day);
      const spot = price ? price.btcUsd / price.stxUsd : null;
      // Skip leading days where the chart would show 0 basis (before any
      // execution in-window AND no seed from prior executions).
      if (basis === 0 && out.length === 0) continue;
      out.push({ date: day, basis, spot });
    }
    return out;
  }, [firstDate, todayISO, sortedEvents, dailyDelta, pricesByDate]);

  // Guard on distinct UTC days, not raw event count: multiple executions in
  // the same day collapse to one bucket and would render an invisible chart
  // (single point with dot={false}).
  if (dailyDelta.size < 2) {
    return (
      <ChartShell>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {tr("need2")}
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
          {tr("pricesUnavailable")}
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
              width={48}
              stroke="var(--border-subtle)"
              domain={["auto", "auto"]}
            />
            <Tooltip content={<CostBasisTooltip />} />
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
              name="Your basis"
              stroke="#A78BFA"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10px]" style={{ color: "var(--text-muted)" }}>
        <LegendDot color="#A78BFA" label={tr("legendBasis")} />
        <LegendDot color="var(--text-muted)" label={tr("legendSpot")} dashed />
      </div>
    </ChartShell>
  );
}

function ChartShell({ children }: { children: React.ReactNode }) {
  const tr = useTranslations("dca.perf");
  return (
    <div className="glass-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={14} style={{ color: "#A78BFA" }} />
        <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
          {tr("chart.title")}
        </h2>
        <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
          {tr("common.lastNDays", { days: MAX_CHART_DAYS })}
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

function CostBasisTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  const tr = useTranslations("dca.perf.chart");
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
        <span style={{ color: "#A78BFA" }}>{tr("tooltipBasis")}</span>
        <span>{Math.round(p.basis).toLocaleString()} STX</span>
      </div>
      <div className="flex items-center justify-between gap-3 font-data">
        <span style={{ color: "var(--text-muted)" }}>{tr("tooltipSpot")}</span>
        <span>{p.spot != null ? `${Math.round(p.spot).toLocaleString()} STX` : "—"}</span>
      </div>
    </div>
  );
}
