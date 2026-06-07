"use client";

import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { Repeat2, Activity, Coins, BarChart3, ArrowUpRight } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useUserDCAPlans, useSTXMarketStats } from "@/hooks/useMarketData";
import { microToSTX } from "@/lib/dca";
import { formatUSD } from "@/lib/utils";

export default function DCAPerformanceCard() {
  const { isConnected, stxAddress } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: plans } = useUserDCAPlans(addr);
  const { data: stx } = useSTXMarketStats();

  if (!isConnected) return null;

  const all = plans ?? [];
  const totalSwapsDone = all.reduce((sum, p) => sum + p.tsd, 0);

  // Hide card until user has executed at least one swap — DCASummaryCard
  // already handles the "create your first plan" CTA.
  if (totalSwapsDone === 0) return null;

  const totalSpentUstx = all.reduce((sum, p) => sum + p.tss, 0);
  const totalSpentSTX = totalSpentUstx / 1_000_000;
  const totalSpentUsd = stx ? totalSpentSTX * stx.price : null;

  const avgPerSwapSTX = totalSwapsDone > 0 ? totalSpentSTX / totalSwapsDone : 0;
  const avgPerSwapUsd = stx ? avgPerSwapSTX * stx.price : null;

  // Planned remaining = floor(bal / amt) per plan; aggregate gives total
  // executions still queued. Combined with tsd this yields a real
  // "X of Y planned swaps · Z% complete" progress without needing
  // block height.
  const plannedRemaining = all.reduce((sum, p) => {
    if (p.amt <= 0) return sum;
    return sum + Math.floor(p.bal / p.amt);
  }, 0);
  const plannedTotal = totalSwapsDone + plannedRemaining;
  const completionPct = plannedTotal > 0 ? Math.round((totalSwapsDone / plannedTotal) * 100) : 0;

  return (
    <div
      className="glass-card rounded-2xl p-5 shadow-sm"
      style={{ ['--card-accent' as string]: '#FFB547' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, #FFB547 18%, transparent)' }}
          >
            <Repeat2 size={15} style={{ color: '#FFB547' }} />
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              DCA Automation
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              How your recurring buys are tracking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dca/performance"
            className="text-xs font-semibold flex items-center gap-1 transition-colors"
            style={{ color: '#FFB547' }}
          >
            See full PnL <ArrowUpRight size={12} />
          </Link>
          <Link
            href="/dca"
            className="text-xs font-medium hidden sm:flex items-center gap-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Manage
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Stat
          icon={<Activity size={12} />}
          label="Swaps executed"
          primary={totalSwapsDone.toLocaleString("en-US")}
          secondary="all-time"
        />
        <Stat
          icon={<Coins size={12} />}
          label="STX invested"
          primary={`${totalSpentSTX.toFixed(2)} STX`}
          secondary={totalSpentUsd !== null ? `${formatUSD(totalSpentUsd)} at spot` : "—"}
        />
        <Stat
          icon={<BarChart3 size={12} />}
          label="Avg per swap"
          primary={`${avgPerSwapSTX.toFixed(2)} STX`}
          secondary={avgPerSwapUsd !== null ? `≈ ${formatUSD(avgPerSwapUsd)}` : "—"}
        />
      </div>

      {/* Completion bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
          >
            Plan completion
          </span>
          <span className="text-[11px] font-data" style={{ color: 'var(--text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {totalSwapsDone}
            </span>
            {' '}of {plannedTotal} planned · {completionPct}%
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(to right, #FFB547, #F7931A)' }}
            initial={{ width: 0 }}
            animate={{ width: `${completionPct}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </div>
        {plannedRemaining > 0 && (
          <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
            {plannedRemaining.toLocaleString("en-US")} swap{plannedRemaining === 1 ? '' : 's'} queued
            from your remaining {(all.reduce((s, p) => s + p.bal, 0) / 1_000_000).toFixed(2)} STX balance
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon, label, primary, secondary,
}: { icon: React.ReactNode; label: string; primary: string; secondary: string }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-muted)' }}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider" style={{ letterSpacing: '0.08em' }}>
          {label}
        </span>
      </div>
      <p className="text-base font-bold font-data" style={{ color: 'var(--text-primary)' }}>
        {primary}
      </p>
      <p className="text-[10px] font-data mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {secondary}
      </p>
    </div>
  );
}
