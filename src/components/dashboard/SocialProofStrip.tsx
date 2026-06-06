"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Repeat, TrendingUp, Activity, BarChart3, Info, WifiOff } from "lucide-react";
import AnimatedCounter from "@/components/motion/AnimatedCounter";
import type { ProtocolMetricsResponse } from "@/lib/server/protocol-metrics";

function formatRelativeTime(ts: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - ts) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Protocol metrics unavailable");
  return response.json();
};

function formatCompactUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}

function formatCompactInt(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

function formatRatio(v: number): string {
  return v.toFixed(1);
}

type MetricKey = "plansCreated" | "volumeUsd" | "swapsExecuted" | "avgSwapsPerPlan";

const METRICS: Array<{
  key: MetricKey;
  label: string;
  icon: typeof TrendingUp;
  color: string;
  format: (v: number) => string;
}> = [
  { key: "plansCreated",    label: "DCA Plans Created", icon: Repeat,     color: "#00C27A", format: formatCompactInt },
  { key: "volumeUsd",       label: "Volume Executed",   icon: TrendingUp, color: "#38BDF8", format: formatCompactUSD },
  { key: "swapsExecuted",   label: "Swaps Executed",    icon: Activity,   color: "#A78BFA", format: formatCompactInt },
  { key: "avgSwapsPerPlan", label: "Avg Swaps / Plan",  icon: BarChart3,  color: "#F472B6", format: formatRatio },
];

export default function SocialProofStrip() {
  const { data, error, isLoading } = useSWR<ProtocolMetricsResponse>("/api/metrics", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  // Re-render every 30s so the relative timestamp stays fresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const updatedLabel = data?.updatedAt ? formatRelativeTime(data.updatedAt, now) : null;
  const availableMetrics = data
    ? METRICS.filter(({ key }) => data[key] !== null)
    : [];

  if (isLoading && !data) {
    return (
      <div
        className="rounded-2xl px-4 py-4"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
        aria-label="Loading live protocol metrics"
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg skeleton" />
              <div className="flex-1">
                <div className="h-4 w-16 rounded skeleton" />
                <div className="mt-2 h-2.5 w-24 rounded skeleton" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || availableMetrics.length === 0) {
    return (
      <div
        className="flex items-center justify-center gap-3 rounded-2xl px-4 py-5 text-center"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
        role="status"
      >
        <WifiOff size={15} style={{ color: "var(--text-muted)" }} />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Live on-chain metrics are temporarily unavailable.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 overflow-hidden relative"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping" style={{ backgroundColor: 'var(--accent)' }} />
            <span className="relative inline-flex w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
          </span>
          <div className="flex flex-col">
            <span
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
            >
              Live on Stacks
            </span>
            {updatedLabel && (
              <span
                className="text-[9px] font-data"
                style={{ color: 'var(--text-muted)' }}
              >
                updated {updatedLabel}
              </span>
            )}
          </div>
          <Info size={11} className="ml-1" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-2 flex-1 min-w-0">
          {availableMetrics.map(({ key, label, icon: Icon, color, format }) => (
            <div key={key} className="flex items-center gap-2 min-w-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}1A` }}
              >
                <Icon size={13} style={{ color }} />
              </div>
              <div className="min-w-0">
                <AnimatedCounter
                  value={data[key] as number}
                  formatFn={format}
                  duration={1400}
                  className="text-sm font-bold font-data block leading-tight"
                  style={{ color: 'var(--text-primary)' }}
                />
                <span
                  className="text-[10px] uppercase tracking-wider truncate block"
                  style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
                >
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p
        className="mt-3 text-[10px] leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        On-chain totals from both DCA vaults. USD volume uses current market
        prices and is hidden when a required source is unavailable.
      </p>
    </div>
  );
}
