"use client";

import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { Bitcoin, Clock, Layers, Info, ArrowUpRight } from "lucide-react";
import { usePoxCycle, usePortfolio } from "@/hooks/useMarketData";
import { useWalletStore } from "@/store/walletStore";
import { formatUSD } from "@/lib/utils";

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-US");
}

function formatCountdown(days: number, blocks: number): { primary: string; secondary: string } {
  if (days >= 1) {
    return { primary: `${days}d`, secondary: `${blocks.toLocaleString("en-US")} burn blocks` };
  }
  const hours = Math.max(0, Math.round((blocks * 10) / 60));
  return { primary: `${hours}h`, secondary: `${blocks.toLocaleString("en-US")} burn blocks` };
}

export default function PoxCycleCard() {
  const { data, isLoading } = usePoxCycle();
  const { isConnected, stxAddress } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: portfolio } = usePortfolio(addr);
  const userStakingUsd = portfolio?.stackingUSD ?? 0;

  if (isLoading || !data) {
    return (
      <div
        className="glass-card rounded-2xl p-5 shadow-sm"
        style={{ ['--card-accent' as string]: '#F7931A' }}
      >
        <div className="h-4 w-32 rounded skeleton mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-16 rounded-xl skeleton" />
          <div className="h-16 rounded-xl skeleton" />
          <div className="h-16 rounded-xl skeleton" />
        </div>
        <div className="h-2 rounded-full skeleton mt-4" />
      </div>
    );
  }

  const countdown = formatCountdown(data.daysUntilNextCycle, data.blocksUntilNextCycle);
  const progress = Math.round(data.cycleProgressPct);

  return (
    <div
      className="glass-card rounded-2xl p-5 shadow-sm"
      style={{ ['--card-accent' as string]: '#F7931A' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, #F7931A 18%, transparent)' }}
          >
            <Bitcoin size={15} style={{ color: '#F7931A' }} />
          </div>
          <div>
            <h2 className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              PoX Cycle <span className="font-data" style={{ color: '#F7931A' }}>#{data.currentCycleId}</span>
              <span title="Proof of Transfer: STX stackers lock STX to earn BTC rewards each ~2-week cycle. Numbers come from /v2/pox on Hiro.">
                <Info size={12} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
              </span>
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Next rewards in <span className="font-semibold font-data" style={{ color: 'var(--text-primary)' }}>{countdown.primary}</span> · {countdown.secondary}
            </p>
          </div>
        </div>
        <Link
          href="https://docs.stacks.co/stacks-101/proof-of-transfer"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium hidden sm:flex items-center gap-1"
          style={{ color: 'var(--accent-text)' }}
        >
          Learn more <ArrowUpRight size={12} />
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className="rounded-xl p-3"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={11} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              Until next
            </span>
          </div>
          <p className="text-base font-bold font-data" style={{ color: 'var(--text-primary)' }}>
            {countdown.primary}
          </p>
        </div>

        <div
          className="rounded-xl p-3"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Layers size={11} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              Total stacked
            </span>
          </div>
          <p className="text-base font-bold font-data" style={{ color: 'var(--text-primary)' }}>
            {formatCompactNumber(data.totalStackedSTX)}
            <span className="text-[10px] font-semibold ml-1" style={{ color: 'var(--text-muted)' }}>STX</span>
          </p>
          <p className="text-[10px] font-data mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {formatUSD(data.totalStackedUsd)}
          </p>
        </div>

        <div
          className="rounded-xl p-3"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              Min threshold
            </span>
          </div>
          <p className="text-base font-bold font-data" style={{ color: 'var(--text-primary)' }}>
            {formatCompactNumber(data.minThresholdSTX)}
            <span className="text-[10px] font-semibold ml-1" style={{ color: 'var(--text-muted)' }}>STX</span>
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            solo stacker
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            Cycle progress
          </span>
          <span className="text-[11px] font-data font-semibold" style={{ color: 'var(--text-primary)' }}>
            {progress}%
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(to right, #F7931A, #FFB547)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* User-stake footer (only when user holds stSTX) */}
      {userStakingUsd > 0 && (
        <Link
          href="/assets"
          className="mt-4 -mb-1 flex items-center justify-between rounded-xl px-3 py-2 transition-colors"
          style={{
            backgroundColor: 'color-mix(in srgb, #A78BFA 8%, transparent)',
            border: '1px solid color-mix(in srgb, #A78BFA 22%, transparent)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: '#A78BFA' }}
            />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Your stSTX stake
            </span>
          </div>
          <span className="text-[11px] font-data font-bold" style={{ color: '#A78BFA' }}>
            {formatUSD(userStakingUsd)}
          </span>
        </Link>
      )}
    </div>
  );
}
