"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import useSWR from "swr";
import {
  ArrowLeft, Activity, Coins, Bitcoin, BarChart3,
  TrendingUp, TrendingDown, Info, ExternalLink,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import EmptyState from "@/components/motion/EmptyState";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";
import { Wallet } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useSTXMarketStats } from "@/hooks/useMarketData";
import {
  getAllUserPlans,
  getPlanExecutionHistory,
  aggregatePlanPerformance,
  blocksToInterval,
  computeLumpSum,
  utcIsoDateFromUnix,
  type DCAPlan,
  type LumpSumScenario,
  type PlanPerformance,
} from "@/lib/dca";
import { getBtcUsdPrice, getHistoricalStxBtcPrices } from "@/lib/stacks";
import { formatUSD } from "@/lib/utils";

interface PlanWithPerf {
  plan: DCAPlan;
  perf: PlanPerformance;
  lumpSum?: LumpSumScenario | null; // null = price lookup failed; undefined = not yet fetched
}

function formatStx(n: number, dp = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function formatSbtc(n: number): string {
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.01) return n.toFixed(5);
  return n.toFixed(8);
}

function formatSats(n: number): string {
  return Math.round(n * 100_000_000).toLocaleString("en-US");
}

function formatDate(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DCAPerformanceContent() {
  const { isConnected, stxAddress } = useWalletStore();
  const { data: stx } = useSTXMarketStats();

  // BTC price for spot comparison; ~60s cache
  const { data: btcUsd } = useSWR<number>("btc-usd-spot", getBtcUsdPrice, {
    refreshInterval: 60_000,
    dedupingInterval: 60_000,
  });

  const { data: planBundle, isLoading: plansLoading } = useSWR(
    isConnected && stxAddress ? ["dca-all-plans", stxAddress] : null,
    () => getAllUserPlans(stxAddress!),
    { dedupingInterval: 30_000 }
  );

  const allPlans = useMemo(() => {
    if (!planBundle) return [] as DCAPlan[];
    return [...planBundle.active, ...planBundle.completed];
  }, [planBundle]);

  // Fetch + aggregate execution history per plan.
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
      // Sequential to be gentle on Hiro rate limit; small N.
      for (const plan of allPlans) {
        try {
          const events = await getPlanExecutionHistory(plan.id, 100);
          const perf = aggregatePlanPerformance(plan.id, events);
          if (cancelled) return;
          results.push({ plan, perf });
        } catch {
          if (cancelled) return;
          results.push({ plan, perf: aggregatePlanPerformance(plan.id, []) });
        }
      }
      if (!cancelled) {
        setPerPlan(results);
        setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [allPlans, planBundle]);

  // Once the per-plan aggregation is done, fetch historical STX/BTC prices
  // on each plan's first-execution date and enrich with a lump-sum scenario.
  // Dates are deduped so two plans starting the same day share one fetch.
  const [lumpSumLoading, setLumpSumLoading] = useState(false);
  useEffect(() => {
    if (!perPlan) return;
    const eligible = perPlan.filter(
      (p) => p.perf.executionCount > 0 && p.perf.firstExecutionAt && p.lumpSum === undefined
    );
    if (eligible.length === 0) return;

    let cancelled = false;
    setLumpSumLoading(true);
    (async () => {
      const uniqueDates = Array.from(
        new Set(eligible.map((p) => utcIsoDateFromUnix(p.perf.firstExecutionAt!)))
      );
      const priceByDate = new Map<string, { stxUsd: number; btcUsd: number } | null>();
      await Promise.all(
        uniqueDates.map(async (d) => {
          const prices = await getHistoricalStxBtcPrices(d);
          priceByDate.set(d, prices);
        })
      );
      if (cancelled) return;
      setPerPlan((prev) => {
        if (!prev) return prev;
        return prev.map((p) => {
          if (p.lumpSum !== undefined) return p;
          if (p.perf.executionCount === 0 || !p.perf.firstExecutionAt) {
            return { ...p, lumpSum: null };
          }
          const date = utcIsoDateFromUnix(p.perf.firstExecutionAt);
          const prices = priceByDate.get(date) ?? null;
          if (!prices) return { ...p, lumpSum: null };
          return {
            ...p,
            lumpSum: computeLumpSum(p.perf, date, prices.stxUsd, prices.btcUsd),
          };
        });
      });
      setLumpSumLoading(false);
    })();
    return () => { cancelled = true; };
  }, [perPlan]);

  const totals = useMemo(() => {
    if (!perPlan) return null;
    const t = perPlan.reduce(
      (acc, { perf }) => ({
        executions: acc.executions + perf.executionCount,
        stxIn: acc.stxIn + perf.totalStxIn,
        sbtcOut: acc.sbtcOut + perf.totalSbtcOut,
        feeStx: acc.feeStx + perf.totalFeeStx,
      }),
      { executions: 0, stxIn: 0, sbtcOut: 0, feeStx: 0 }
    );
    const avgStxPerSbtc = t.sbtcOut > 0 ? t.stxIn / t.sbtcOut : 0;
    return { ...t, avgStxPerSbtc };
  }, [perPlan]);

  // Spot reference: how many STX would 1 sBTC cost RIGHT NOW
  const spotStxPerSbtc = stx && btcUsd && stx.price > 0 ? btcUsd / stx.price : null;
  const basisVsSpotPct =
    totals && spotStxPerSbtc && totals.avgStxPerSbtc > 0
      ? ((spotStxPerSbtc - totals.avgStxPerSbtc) / spotStxPerSbtc) * 100
      : null;

  // Aggregate lump-sum across plans where historical prices succeeded.
  const lumpSumAggregate = useMemo(() => {
    if (!perPlan) return null;
    const eligible = perPlan.filter((p) => p.lumpSum);
    if (eligible.length === 0) return null;
    const sumActualSbtc = eligible.reduce((s, p) => s + p.perf.totalSbtcOut, 0);
    const sumLumpSbtc   = eligible.reduce((s, p) => s + (p.lumpSum?.lumpSumSbtc ?? 0), 0);
    const sumStxIn      = eligible.reduce((s, p) => s + p.perf.totalStxIn, 0);
    const deltaSbtc = sumActualSbtc - sumLumpSbtc;
    const deltaPct = sumLumpSbtc > 0 ? (deltaSbtc / sumLumpSbtc) * 100 : 0;
    const totalEligiblePlans = perPlan.filter(
      (p) => p.perf.executionCount > 0
    ).length;
    const skipped = totalEligiblePlans - eligible.length;
    return { sumActualSbtc, sumLumpSbtc, sumStxIn, deltaSbtc, deltaPct, skipped, count: eligible.length };
  }, [perPlan]);

  // True only after enrichment has run AND every plan with executions ended
  // up with lumpSum === null. Lets us show an explicit error state instead
  // of silently hiding the entire lump-sum block.
  const allLumpSumsFailed = !!(
    perPlan &&
    !lumpSumLoading &&
    perPlan.some((p) => p.perf.executionCount > 0) &&
    perPlan.every((p) => p.perf.executionCount === 0 || p.lumpSum === null)
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="DCA Performance" />
      <AnimatedPage className="max-w-5xl mx-auto w-full px-4 py-6">
        <StaggerChildren className="flex flex-col gap-6">

          {/* Back link + header */}
          <MotionCard disableHover>
            <div className="flex items-center justify-between">
              <Link
                href="/dca"
                className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <ArrowLeft size={14} />
                Back to plans
              </Link>
              {totals && totals.executions > 0 && (
                <span
                  className="text-[11px] font-data"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {totals.executions} swap{totals.executions === 1 ? '' : 's'} analyzed
                </span>
              )}
            </div>
          </MotionCard>

          {!isConnected ? (
            <MotionCard disableHover>
              <div className="glass-card rounded-2xl" style={{ boxShadow: "var(--shadow-card)" }}>
                <EmptyState
                  icon={<Wallet size={28} style={{ color: "var(--accent)" }} />}
                  title="Connect your wallet to view performance"
                  description="Connect to see cost basis and execution history for all your DCA plans."
                  action={<ConnectWalletCTA />}
                />
              </div>
            </MotionCard>
          ) : plansLoading || historyLoading || !perPlan ? (
            <MotionCard disableHover>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 rounded-2xl skeleton" />
                ))}
              </div>
            </MotionCard>
          ) : totals && totals.executions === 0 ? (
            <MotionCard disableHover>
              <div
                className="glass-card rounded-2xl p-8 text-center"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  No executions yet
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Your plans haven&apos;t been executed by the keeper bot yet. Performance metrics will appear once the first swap completes.
                </p>
              </div>
            </MotionCard>
          ) : totals && (
            <>
              {/* Overall summary stats */}
              <MotionCard disableHover>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <SummaryCard
                    icon={<Activity size={13} />}
                    label="Swaps executed"
                    primary={totals.executions.toLocaleString("en-US")}
                    secondary={`across ${perPlan.length} plan${perPlan.length === 1 ? '' : 's'}`}
                    accent="#FFB547"
                  />
                  <SummaryCard
                    icon={<Coins size={13} />}
                    label="STX invested"
                    primary={`${formatStx(totals.stxIn)} STX`}
                    secondary={stx ? `${formatUSD(totals.stxIn * stx.price)} at spot` : '—'}
                    accent="#00C27A"
                  />
                  <SummaryCard
                    icon={<Bitcoin size={13} />}
                    label="sBTC accumulated"
                    primary={`${formatSbtc(totals.sbtcOut)} sBTC`}
                    secondary={btcUsd ? `${formatUSD(totals.sbtcOut * btcUsd)} at spot` : '—'}
                    accent="#F7931A"
                  />
                  <SummaryCard
                    icon={<BarChart3 size={13} />}
                    label="Avg cost basis"
                    primary={`${formatStx(totals.avgStxPerSbtc, 1)} STX`}
                    secondary="per 1 sBTC"
                    accent="#A78BFA"
                  />
                </div>
              </MotionCard>

              {/* Spot comparison strip */}
              {spotStxPerSbtc && basisVsSpotPct !== null && (
                <MotionCard disableHover>
                  <div
                    className="glass-card rounded-2xl p-5"
                    style={{
                      ['--card-accent' as string]: basisVsSpotPct >= 0 ? '#00C27A' : '#F04A6E',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: basisVsSpotPct >= 0
                              ? 'color-mix(in srgb, #00C27A 18%, transparent)'
                              : 'color-mix(in srgb, #F04A6E 18%, transparent)',
                          }}
                        >
                          {basisVsSpotPct >= 0
                            ? <TrendingDown size={16} style={{ color: '#00C27A' }} />
                            : <TrendingUp size={16} style={{ color: '#F04A6E' }} />}
                        </div>
                        <div>
                          <h2 className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            Your basis vs today&apos;s spot
                            <span title="Compares your weighted-avg STX per sBTC across all executed swaps against the current STX/sBTC rate (BTC USD / STX USD). Positive % means you got more sBTC per STX than today's spot would give you.">
                              <Info size={12} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
                            </span>
                          </h2>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Spot: 1 sBTC = <span className="font-data font-semibold" style={{ color: 'var(--text-primary)' }}>{formatStx(spotStxPerSbtc, 0)}</span> STX ·
                            Your avg: <span className="font-data font-semibold" style={{ color: 'var(--text-primary)' }}>{formatStx(totals.avgStxPerSbtc, 0)}</span> STX
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className="text-2xl font-bold font-data"
                          style={{
                            color: basisVsSpotPct >= 0 ? '#00C27A' : '#F04A6E',
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {basisVsSpotPct >= 0 ? '+' : ''}{basisVsSpotPct.toFixed(1)}%
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {basisVsSpotPct >= 0 ? 'cheaper than spot' : 'above spot'}
                        </p>
                      </div>
                    </div>
                  </div>
                </MotionCard>
              )}

              {/* Lump-sum comparison (historical day-0 prices) */}
              {lumpSumAggregate ? (
                <MotionCard disableHover>
                  <div
                    className="glass-card rounded-2xl p-5"
                    style={{
                      ['--card-accent' as string]: lumpSumAggregate.deltaPct >= 0 ? '#00C27A' : '#F04A6E',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: lumpSumAggregate.deltaPct >= 0
                              ? 'color-mix(in srgb, #00C27A 18%, transparent)'
                              : 'color-mix(in srgb, #F04A6E 18%, transparent)',
                          }}
                        >
                          <BarChart3 size={16} style={{ color: lumpSumAggregate.deltaPct >= 0 ? '#00C27A' : '#F04A6E' }} />
                        </div>
                        <div>
                          <h2 className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            DCA vs lump sum
                            <span title="For each plan, we look up the STX-USD and BTC-USD closing prices on the day of that plan's first execution and ask: if you had dumped the same total STX-in into sBTC on day 0 at the then-spot rate, how much sBTC would you hold? The delta shows whether DCA beat or trailed that counterfactual buy. Excludes plans where historical prices couldn't be fetched.">
                              <Info size={12} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
                            </span>
                          </h2>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Across {lumpSumAggregate.count} plan{lumpSumAggregate.count === 1 ? '' : 's'} ·
                            actual <span className="font-data font-semibold" style={{ color: 'var(--text-primary)' }}>{formatSbtc(lumpSumAggregate.sumActualSbtc)}</span> sBTC vs
                            lump <span className="font-data font-semibold" style={{ color: 'var(--text-primary)' }}>{formatSbtc(lumpSumAggregate.sumLumpSbtc)}</span> sBTC
                          </p>
                          {lumpSumAggregate.skipped > 0 && (
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {lumpSumAggregate.skipped} plan{lumpSumAggregate.skipped === 1 ? '' : 's'} excluded — historical price unavailable
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className="text-2xl font-bold font-data"
                          style={{
                            color: lumpSumAggregate.deltaPct >= 0 ? '#00C27A' : '#F04A6E',
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {lumpSumAggregate.deltaPct >= 0 ? '+' : ''}{lumpSumAggregate.deltaPct.toFixed(1)}%
                        </p>
                        <p className="text-[11px] font-data" style={{ color: 'var(--text-muted)' }}>
                          {lumpSumAggregate.deltaSbtc >= 0 ? '+' : ''}{formatSbtc(Math.abs(lumpSumAggregate.deltaSbtc))} sBTC vs lump
                        </p>
                      </div>
                    </div>
                  </div>
                </MotionCard>
              ) : lumpSumLoading ? (
                <MotionCard disableHover>
                  <div className="glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg skeleton" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 rounded skeleton" />
                        <div className="h-3 w-64 rounded skeleton" />
                      </div>
                      <div className="h-8 w-20 rounded skeleton" />
                    </div>
                  </div>
                </MotionCard>
              ) : allLumpSumsFailed ? (
                <MotionCard disableHover>
                  <div
                    className="glass-card rounded-2xl p-5"
                    style={{ ['--card-accent' as string]: 'var(--text-muted)' }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--bg-elevated)' }}
                      >
                        <BarChart3 size={16} style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <div>
                        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Lump-sum comparison unavailable
                        </h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Historical STX/BTC prices for your plan start dates couldn&apos;t be fetched from CoinGecko. The basis-vs-today&apos;s-spot strip above still works.
                        </p>
                      </div>
                    </div>
                  </div>
                </MotionCard>
              ) : null}

              {/* Per-plan breakdown */}
              <MotionCard disableHover>
                <div
                  className="glass-card rounded-2xl p-5"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Per-plan breakdown
                  </h2>
                  <div className="space-y-3">
                    {perPlan
                      .filter((p) => p.perf.executionCount > 0)
                      .sort((a, b) => b.perf.totalStxIn - a.perf.totalStxIn)
                      .map(({ plan, perf, lumpSum }) => (
                        <PlanRow
                          key={plan.id}
                          plan={plan}
                          perf={perf}
                          stxUsd={stx?.price ?? 0}
                          btcUsd={btcUsd ?? 0}
                          lumpSum={lumpSum ?? null}
                        />
                      ))}
                  </div>
                </div>
              </MotionCard>
            </>
          )}
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}

function SummaryCard({
  icon, label, primary, secondary, accent,
}: { icon: React.ReactNode; label: string; primary: string; secondary: string; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card rounded-2xl p-4"
      style={{ ['--card-accent' as string]: accent, boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: accent }}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ letterSpacing: '0.08em' }}>
          {label}
        </span>
      </div>
      <p className="text-base font-bold font-data leading-tight" style={{ color: 'var(--text-primary)' }}>
        {primary}
      </p>
      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
        {secondary}
      </p>
    </motion.div>
  );
}

function PlanRow({
  plan, perf, stxUsd, btcUsd, lumpSum,
}: { plan: DCAPlan; perf: PlanPerformance; stxUsd: number; btcUsd: number; lumpSum: LumpSumScenario | null }) {
  const planStxValueUsd = stxUsd ? perf.totalStxIn * stxUsd : null;
  const planSbtcValueUsd = btcUsd ? perf.totalSbtcOut * btcUsd : null;
  const cadence = blocksToInterval(plan.ivl);

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md font-data"
            style={{
              backgroundColor: plan.active ? 'color-mix(in srgb, #00C27A 14%, transparent)' : 'var(--border-subtle)',
              color: plan.active ? '#00C27A' : 'var(--text-muted)',
            }}
          >
            Plan #{plan.id}
          </span>
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
          >
            every {cadence}
          </span>
          {!plan.active && (
            <span
              className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
            >
              · completed
            </span>
          )}
        </div>
        <span className="text-[11px] font-data" style={{ color: 'var(--text-muted)' }}>
          {formatDate(perf.firstExecutionAt ?? 0)} → {formatDate(perf.lastExecutionAt ?? 0)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Cell label="Executions" value={perf.executionCount.toString()} />
        <Cell
          label="STX in"
          value={`${formatStx(perf.totalStxIn)}`}
          sub={planStxValueUsd !== null ? formatUSD(planStxValueUsd) : undefined}
        />
        <Cell
          label="sBTC out"
          value={formatSbtc(perf.totalSbtcOut)}
          sub={`${formatSats(perf.totalSbtcOut)} sats`}
        />
        <Cell
          label="Avg cost"
          value={`${formatStx(perf.avgStxPerSbtc, 0)} STX/sBTC`}
          sub={planSbtcValueUsd !== null ? `≈ ${formatUSD(planSbtcValueUsd)} now` : undefined}
        />
      </div>

      {lumpSum && (
        <div
          className="mt-3 pt-3 flex items-center justify-between flex-wrap gap-2"
          style={{ borderTop: '1px dashed var(--border-subtle)' }}
        >
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="font-semibold uppercase tracking-wider" style={{ letterSpacing: '0.08em' }}>vs lump sum</span>
            {' '}on {formatDate(new Date(lumpSum.referenceDate + 'T00:00:00Z').getTime() / 1000)} —
            lump would&apos;ve been <span className="font-data" style={{ color: 'var(--text-secondary)' }}>{formatSbtc(lumpSum.lumpSumSbtc)}</span> sBTC
          </p>
          <span
            className="text-[11px] font-data font-bold px-2 py-0.5 rounded-md"
            style={{
              color: lumpSum.deltaPct >= 0 ? '#00C27A' : '#F04A6E',
              backgroundColor: lumpSum.deltaPct >= 0
                ? 'color-mix(in srgb, #00C27A 14%, transparent)'
                : 'color-mix(in srgb, #F04A6E 14%, transparent)',
            }}
          >
            {lumpSum.deltaPct >= 0 ? '+' : ''}{lumpSum.deltaPct.toFixed(1)}%
          </span>
        </div>
      )}

      {perf.successfulEvents.length > 0 && (
        <Link
          href={`https://explorer.hiro.so/txid/${perf.successfulEvents[perf.successfulEvents.length - 1].txId}?chain=mainnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
          style={{ color: 'var(--accent)' }}
        >
          Latest execution <ExternalLink size={10} />
        </Link>
      )}
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p className="font-data font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] font-data mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}
