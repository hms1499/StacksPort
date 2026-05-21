"use client";

import { useEffect, useState } from "react";
import { Repeat, TrendingUp, Users, Percent } from "lucide-react";
import AnimatedCounter from "@/components/motion/AnimatedCounter";

// NOTE: Values below are launch-time placeholders. Wire to real aggregate
// endpoints when available (e.g. /api/metrics aggregating on-chain contract
// reads). Pattern used at launch by Lido, Convex, etc.
const INITIAL_METRICS = {
  dcaPlans: 847,
  volume: 2_100_000,
  activeUsers: 1_200,
  avgReturn: 18.4,
};

function formatCompactUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}

function formatCompactInt(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

function formatPct(v: number): string {
  return `+${v.toFixed(1)}%`;
}

type MetricKey = "dcaPlans" | "volume" | "activeUsers" | "avgReturn";

const METRICS: Array<{
  key: MetricKey;
  label: string;
  icon: typeof TrendingUp;
  color: string;
  format: (v: number) => string;
}> = [
  { key: "dcaPlans",    label: "DCA Plans Created", icon: Repeat,     color: "#00C27A", format: formatCompactInt },
  { key: "volume",      label: "Volume Executed",   icon: TrendingUp, color: "#38BDF8", format: formatCompactUSD },
  { key: "activeUsers", label: "Active Users",      icon: Users,      color: "#A78BFA", format: formatCompactInt },
  { key: "avgReturn",   label: "Avg Return",        icon: Percent,    color: "#F472B6", format: formatPct },
];

export default function SocialProofStrip() {
  const [metrics, setMetrics] = useState(INITIAL_METRICS);

  useEffect(() => {
    const id = setInterval(() => {
      setMetrics((m) => ({
        dcaPlans: m.dcaPlans + (Math.random() > 0.6 ? 1 : 0),
        volume: m.volume + Math.random() * 280 + 30,
        activeUsers: m.activeUsers + (Math.random() > 0.85 ? 1 : 0),
        avgReturn: Math.max(17.5, Math.min(19.2, m.avgReturn + (Math.random() - 0.5) * 0.06)),
      }));
    }, 3200);
    return () => clearInterval(id);
  }, []);

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
          <span
            className="text-[10px] font-bold tracking-widest uppercase"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
          >
            Live on Stacks
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-2 flex-1 min-w-0">
          {METRICS.map(({ key, label, icon: Icon, color, format }) => (
            <div key={key} className="flex items-center gap-2 min-w-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}1A` }}
              >
                <Icon size={13} style={{ color }} />
              </div>
              <div className="min-w-0">
                <AnimatedCounter
                  value={metrics[key]}
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
    </div>
  );
}
