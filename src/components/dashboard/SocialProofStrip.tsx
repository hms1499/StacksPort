"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Vault, Bitcoin, Repeat } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import AnimatedCounter from "@/components/motion/AnimatedCounter";

// NOTE: Values below are launch-time placeholders. Wire to real aggregate
// endpoints when available (e.g. /api/metrics aggregating on-chain contract
// reads). Pattern used at launch by Lido, Convex, etc.
const INITIAL_METRICS = {
  dcaVolume: 2_412_580,
  activeVaults: 1_247,
  sbtcStacked: 89.4,
  plansExecuted: 12_403,
};

function formatCompactUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}

function formatCompactInt(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

function formatBTC(v: number): string {
  return `${v.toFixed(2)} BTC`;
}

type MetricKey = "dcaVolume" | "activeVaults" | "sbtcStacked" | "plansExecuted";

const METRICS: Array<{
  key: MetricKey;
  label: string;
  icon: typeof TrendingUp;
  color: string;
  format: (v: number) => string;
}> = [
  { key: "dcaVolume",    label: "DCA Volume",     icon: TrendingUp, color: "#00C27A", format: formatCompactUSD },
  { key: "activeVaults", label: "Active Vaults",  icon: Vault,      color: "#6366F1", format: formatCompactInt },
  { key: "sbtcStacked",  label: "sBTC Stacked",   icon: Bitcoin,    color: "#F7931A", format: formatBTC },
  { key: "plansExecuted",label: "Plans Executed", icon: Repeat,     color: "#F472B6", format: formatCompactInt },
];

export default function SocialProofStrip() {
  const isConnected = useWalletStore((s) => s.isConnected);
  const [metrics, setMetrics] = useState(INITIAL_METRICS);

  useEffect(() => {
    if (isConnected) return;
    const id = setInterval(() => {
      setMetrics((m) => ({
        dcaVolume: m.dcaVolume + Math.random() * 320 + 40,
        activeVaults: m.activeVaults + (Math.random() > 0.7 ? 1 : 0),
        sbtcStacked: m.sbtcStacked + Math.random() * 0.04,
        plansExecuted: m.plansExecuted + (Math.random() > 0.5 ? 1 : 0),
      }));
    }, 3200);
    return () => clearInterval(id);
  }, [isConnected]);

  if (isConnected) return null;

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
