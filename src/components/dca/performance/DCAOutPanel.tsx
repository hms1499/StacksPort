"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import useSWR from "swr";
import {
  Activity, Bitcoin, BarChart3, TrendingUp, TrendingDown,
  Info, ExternalLink, DollarSign, Wallet,
} from "lucide-react";
import MotionCard from "@/components/motion/MotionCard";
import EmptyState from "@/components/motion/EmptyState";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";
import {
  getAllSBTCUserPlans,
  getSBTCPlanExecutionHistory,
  aggregateSBTCPlanPerformance,
  blocksToInterval,
  type DCA_SBTCPlan,
  type SBTCPlanPerformance,
} from "@/lib/dca-sbtc";
import { getBtcUsdPrice } from "@/lib/stacks";
import { formatUSD } from "@/lib/utils";
import CostBasisOutChart from "./CostBasisOutChart";

interface PlanWithPerf {
  plan: DCA_SBTCPlan;
  perf: SBTCPlanPerformance;
}

function formatSbtc(n: number): string {
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.01) return n.toFixed(5);
  return n.toFixed(8);
}
function formatNum(n: number, dp = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function formatDate(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// USDCx ≈ $1 for v1; if more target tokens are added, look up per-token price.
const TOKEN_USD = 1;
const TOKEN_LABEL = "USDCx";

export default function DCAOutPanel({
  isConnected, stxAddress,
}: { isConnected: boolean; stxAddress: string | null }) {
  const { data: btcUsd } = useSWR<number>("btc-usd-spot", getBtcUsdPrice, {
    refreshInterval: 60_000, dedupingInterval: 60_000,
  });

  const { data: planBundle, isLoading: plansLoading } = useSWR(
    isConnected && stxAddress ? ["sbtc-all-plans", stxAddress] : null,
    () => getAllSBTCUserPlans(stxAddress!),
    { dedupingInterval: 30_000 }
  );

  const allPlans = useMemo(() => {
    if (!planBundle) return [] as DCA_SBTCPlan[];
    return [...planBundle.active, ...planBundle.completed];
  }, [planBundle]);

  const [perPlan, setPerPlan] = useState<PlanWithPerf[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (allPlans.length === 0) {
      setPerPlan(planBundle ? [] : null);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    (async () => {
      const results: PlanWithPerf[] = [];
      for (const plan of allPlans) {
        try {
          const events = await getSBTCPlanExecutionHistory(plan.id, plan.token, 100, plan.owner);
          const perf = aggregateSBTCPlanPerformance(plan.id, events);
          if (cancelled) return;
          results.push({ plan, perf });
        } catch {
          if (cancelled) return;
          results.push({ plan, perf: aggregateSBTCPlanPerformance(plan.id, []) });
        }
      }
      if (!cancelled) {
        setPerPlan(results);
        setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [allPlans, planBundle]);

  const totals = useMemo(() => {
    if (!perPlan) return null;
    const t = perPlan.reduce(
      (acc, { perf }) => ({
        executions: acc.executions + perf.executionCount,
        sbtcIn: acc.sbtcIn + perf.totalSbtcIn / 1e8, // sats → sBTC
        tokenOut: acc.tokenOut + perf.totalTokenOut,
      }),
      { executions: 0, sbtcIn: 0, tokenOut: 0 }
    );
    const avgTokenPerSbtc = t.sbtcIn > 0 ? t.tokenOut / t.sbtcIn : 0;
    return { ...t, avgTokenPerSbtc };
  }, [perPlan]);

  const spotTokenPerSbtc = btcUsd && btcUsd > 0 ? btcUsd / TOKEN_USD : null;
  const sellVsSpotPct =
    totals && spotTokenPerSbtc && totals.avgTokenPerSbtc > 0
      ? ((totals.avgTokenPerSbtc - spotTokenPerSbtc) / spotTokenPerSbtc) * 100
      : null;

  if (!isConnected) {
    return (
      <MotionCard disableHover>
        <div className="glass-card rounded-2xl" style={{ boxShadow: "var(--shadow-card)" }}>
          <EmptyState
            icon={<Wallet size={28} style={{ color: "var(--accent)" }} />}
            title="Connect your wallet to view performance"
            description="Connect to see your sBTC→USDCx sell history."
            action={<ConnectWalletCTA />}
          />
        </div>
      </MotionCard>
    );
  }
  if (plansLoading || historyLoading || !perPlan) {
    return (
      <MotionCard disableHover>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-2xl skeleton" />)}
        </div>
      </MotionCard>
    );
  }
  if (perPlan.length === 0) {
    return (
      <MotionCard disableHover>
        <div className="glass-card rounded-2xl p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No DCA Out plans yet</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            DCA Out converts sBTC back into USDCx on a schedule. Useful for taking profit or scheduled exits.
          </p>
          <Link href="/dca?direction=out"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--accent)', color: '#000' }}>
            Create a DCA Out plan →
          </Link>
        </div>
      </MotionCard>
    );
  }
  if (totals && totals.executions === 0) {
    return (
      <MotionCard disableHover>
        <div className="glass-card rounded-2xl p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No executions yet</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Your DCA Out plans haven&apos;t been executed by the keeper bot yet.
          </p>
        </div>
      </MotionCard>
    );
  }
  if (!totals) return null;

  return (
    <>
      {totals.executions > 0 && (
        <MotionCard disableHover>
          <div className="flex justify-end">
            <span className="text-[11px] font-data" style={{ color: 'var(--text-muted)' }}>
              {totals.executions} swap{totals.executions === 1 ? '' : 's'} analyzed
            </span>
          </div>
        </MotionCard>
      )}

      <MotionCard disableHover>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard icon={<Activity size={13} />} label="Swaps executed"
            primary={totals.executions.toLocaleString("en-US")}
            secondary={`across ${perPlan.length} plan${perPlan.length === 1 ? '' : 's'}`}
            accent="#FFB547" />
          <SummaryCard icon={<Bitcoin size={13} />} label="sBTC invested"
            primary={`${formatSbtc(totals.sbtcIn)} sBTC`}
            secondary={btcUsd ? `${formatUSD(totals.sbtcIn * btcUsd)} at spot` : '—'}
            accent="#F7931A" />
          <SummaryCard icon={<DollarSign size={13} />} label={`${TOKEN_LABEL} received`}
            primary={`${formatNum(totals.tokenOut)} ${TOKEN_LABEL}`}
            secondary={`${formatUSD(totals.tokenOut * TOKEN_USD)}`}
            accent="#00C27A" />
          <SummaryCard icon={<BarChart3 size={13} />} label="Avg sell rate"
            primary={`${formatNum(totals.avgTokenPerSbtc, 0)} ${TOKEN_LABEL}`}
            secondary="per 1 sBTC" accent="#A78BFA" />
        </div>
      </MotionCard>

      {spotTokenPerSbtc && sellVsSpotPct !== null && (
        <MotionCard disableHover>
          <div className="glass-card rounded-2xl p-5"
            style={{ ['--card-accent' as string]: sellVsSpotPct >= 0 ? '#00C27A' : '#F04A6E' }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: sellVsSpotPct >= 0
                      ? 'color-mix(in srgb, #00C27A 18%, transparent)'
                      : 'color-mix(in srgb, #F04A6E 18%, transparent)',
                  }}>
                  {sellVsSpotPct >= 0
                    ? <TrendingUp size={16} style={{ color: '#00C27A' }} />
                    : <TrendingDown size={16} style={{ color: '#F04A6E' }} />}
                </div>
                <div>
                  <h2 className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    Your sell rate vs today&apos;s spot
                    <span title="Weighted-avg USDCx received per sBTC across executions vs current sBTC→USDCx rate (BTC USD, since USDCx ≈ $1). Positive % means you sold at better-than-current rates.">
                      <Info size={12} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
                    </span>
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Spot: 1 sBTC ≈ <span className="font-data font-semibold" style={{ color: 'var(--text-primary)' }}>{formatNum(spotTokenPerSbtc, 0)}</span> {TOKEN_LABEL} ·
                    Your avg: <span className="font-data font-semibold" style={{ color: 'var(--text-primary)' }}>{formatNum(totals.avgTokenPerSbtc, 0)}</span> {TOKEN_LABEL}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold font-data"
                  style={{ color: sellVsSpotPct >= 0 ? '#00C27A' : '#F04A6E', letterSpacing: '-0.02em' }}>
                  {sellVsSpotPct >= 0 ? '+' : ''}{sellVsSpotPct.toFixed(1)}%
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {sellVsSpotPct >= 0 ? 'sold above spot' : 'sold below spot'}
                </p>
              </div>
            </div>
          </div>
        </MotionCard>
      )}

      <MotionCard disableHover>
        <CostBasisOutChart perPlan={perPlan} />
      </MotionCard>

      <MotionCard disableHover>
        <div className="glass-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Per-plan breakdown</h2>
          <div className="space-y-3">
            {perPlan
              .filter((p) => p.perf.executionCount > 0)
              .sort((a, b) => b.perf.totalSbtcIn - a.perf.totalSbtcIn)
              .map(({ plan, perf }) => (
                <PlanRow key={plan.id} plan={plan} perf={perf} btcUsd={btcUsd ?? 0} />
              ))}
          </div>
        </div>
      </MotionCard>
    </>
  );
}

function SummaryCard({ icon, label, primary, secondary, accent }:
  { icon: React.ReactNode; label: string; primary: string; secondary: string; accent: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="glass-card rounded-2xl p-4"
      style={{ ['--card-accent' as string]: accent, boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: accent }}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ letterSpacing: '0.08em' }}>{label}</span>
      </div>
      <p className="text-base font-bold font-data leading-tight" style={{ color: 'var(--text-primary)' }}>{primary}</p>
      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{secondary}</p>
    </motion.div>
  );
}

function PlanRow({ plan, perf, btcUsd }:
  { plan: DCA_SBTCPlan; perf: SBTCPlanPerformance; btcUsd: number }) {
  const sbtc = perf.totalSbtcIn / 1e8;
  const sbtcUsd = btcUsd ? sbtc * btcUsd : null;
  const tokenUsd = perf.totalTokenOut * TOKEN_USD;
  const cadence = blocksToInterval(plan.ivl);

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md font-data"
            style={{
              backgroundColor: plan.active ? 'color-mix(in srgb, #00C27A 14%, transparent)' : 'var(--border-subtle)',
              color: plan.active ? '#00C27A' : 'var(--text-muted)',
            }}>
            Plan #{plan.id}
          </span>
          <span className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>every {cadence}</span>
          {!plan.active && (
            <span className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>· completed</span>
          )}
        </div>
        <span className="text-[11px] font-data" style={{ color: 'var(--text-muted)' }}>
          {formatDate(perf.firstExecutionAt ?? 0)} → {formatDate(perf.lastExecutionAt ?? 0)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Cell label="Executions" value={perf.executionCount.toString()} />
        <Cell label="sBTC in" value={formatSbtc(sbtc)}
          sub={sbtcUsd !== null ? formatUSD(sbtcUsd) : undefined} />
        <Cell label={`${TOKEN_LABEL} out`} value={formatNum(perf.totalTokenOut)}
          sub={formatUSD(tokenUsd)} />
        <Cell label="Avg rate" value={`${formatNum(perf.avgTokenPerSbtc, 0)} ${TOKEN_LABEL}/sBTC`} />
      </div>

      {perf.successfulEvents.length > 0 && (
        <Link href={`https://explorer.hiro.so/txid/${perf.successfulEvents[0].txId}?chain=mainnet`}
          target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
          style={{ color: 'var(--accent)' }}>
          Latest execution <ExternalLink size={10} />
        </Link>
      )}
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{label}</p>
      <p className="font-data font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-[10px] font-data mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}
