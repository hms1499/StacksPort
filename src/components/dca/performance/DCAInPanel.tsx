"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import useSWR from "swr";
import {
  Activity, Coins, Bitcoin, BarChart3,
  TrendingUp, TrendingDown, Info, ExternalLink,
} from "lucide-react";
import MotionCard from "@/components/motion/MotionCard";
import EmptyState from "@/components/motion/EmptyState";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";
import { Wallet } from "lucide-react";
import { useSTXMarketStats } from "@/hooks/useMarketData";
import {
  batchedMap,
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
import CostBasisChart from "./CostBasisChart";

interface PlanWithPerf {
  plan: DCAPlan;
  perf: PlanPerformance;
  lumpSum?: LumpSumScenario | null;
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
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function DCAInPanel({
  isConnected, stxAddress,
}: { isConnected: boolean; stxAddress: string | null }) {
  const tr = useTranslations("dca.perf");
  const { data: stx } = useSTXMarketStats();
  const { data: btcUsd } = useSWR<number>("btc-usd-spot", getBtcUsdPrice, {
    refreshInterval: 60_000, dedupingInterval: 60_000,
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
      const results = await batchedMap(allPlans, async (plan) => {
        try {
          const events = await getPlanExecutionHistory(plan.id, 100, plan.owner);
          return { plan, perf: aggregatePlanPerformance(plan.id, events) };
        } catch {
          return { plan, perf: aggregatePlanPerformance(plan.id, []) };
        }
      }, 5);
      if (!cancelled) {
        setPerPlan(results);
        setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [allPlans, planBundle]);

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
      // Cap concurrency: CoinGecko free tier rate-limits aggressively, and a
      // user with 10 plans on different first-execution dates would otherwise
      // fan out 10 parallel /history calls.
      await batchedMap(uniqueDates, async (d) => {
        const prices = await getHistoricalStxBtcPrices(d);
        priceByDate.set(d, prices);
      }, 3);
      if (cancelled) { setLumpSumLoading(false); return; }
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

  const spotStxPerSbtc = stx && btcUsd && stx.price > 0 ? btcUsd / stx.price : null;
  const basisVsSpotPct =
    totals && spotStxPerSbtc && totals.avgStxPerSbtc > 0
      ? ((spotStxPerSbtc - totals.avgStxPerSbtc) / spotStxPerSbtc) * 100
      : null;

  const lumpSumAggregate = useMemo(() => {
    if (!perPlan) return null;
    const eligible = perPlan.filter((p) => p.lumpSum);
    if (eligible.length === 0) return null;
    const sumActualSbtc = eligible.reduce((s, p) => s + p.perf.totalSbtcOut, 0);
    const sumLumpSbtc = eligible.reduce((s, p) => s + (p.lumpSum?.lumpSumSbtc ?? 0), 0);
    const sumStxIn = eligible.reduce((s, p) => s + p.perf.totalStxIn, 0);
    const deltaSbtc = sumActualSbtc - sumLumpSbtc;
    const deltaPct = sumLumpSbtc > 0 ? (deltaSbtc / sumLumpSbtc) * 100 : 0;
    const totalEligiblePlans = perPlan.filter((p) => p.perf.executionCount > 0).length;
    const skipped = totalEligiblePlans - eligible.length;
    return { sumActualSbtc, sumLumpSbtc, sumStxIn, deltaSbtc, deltaPct, skipped, count: eligible.length };
  }, [perPlan]);

  const allLumpSumsFailed = !!(
    perPlan &&
    !lumpSumLoading &&
    perPlan.some((p) => p.perf.executionCount > 0) &&
    perPlan.every((p) => p.perf.executionCount === 0 || p.lumpSum === null)
  );

  if (!isConnected) {
    return (
      <MotionCard disableHover>
        <div className="glass-card rounded-2xl" style={{ boxShadow: "var(--shadow-card)" }}>
          <EmptyState
            icon={<Wallet size={28} style={{ color: "var(--accent-text)" }} />}
            title={tr("common.connectTitle")}
            description={tr("in.connectDesc")}
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
  if (totals && totals.executions === 0) {
    return (
      <MotionCard disableHover>
        <div className="glass-card rounded-2xl p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {tr("common.noExecutions")}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {tr("in.noExecDesc")}
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
              {tr("common.swapsAnalyzed", { count: totals.executions })}
            </span>
          </div>
        </MotionCard>
      )}

      <MotionCard disableHover>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard icon={<Activity size={13} />} label={tr("common.swapsExecuted")}
            primary={totals.executions.toLocaleString("en-US")}
            secondary={tr("common.acrossPlans", { count: perPlan.length })}
            accent="#FFB547" />
          <SummaryCard icon={<Coins size={13} />} label={tr("in.stxInvested")}
            primary={`${formatStx(totals.stxIn)} STX`}
            secondary={stx ? tr("common.atSpot", { value: formatUSD(totals.stxIn * stx.price) }) : '—'}
            accent="#00C27A" />
          <SummaryCard icon={<Bitcoin size={13} />} label={tr("in.sbtcAccumulated")}
            primary={`${formatSbtc(totals.sbtcOut)} sBTC`}
            secondary={btcUsd ? tr("common.atSpot", { value: formatUSD(totals.sbtcOut * btcUsd) }) : '—'}
            accent="#F7931A" />
          <SummaryCard icon={<BarChart3 size={13} />} label={tr("in.avgCostBasis")}
            primary={`${formatStx(totals.avgStxPerSbtc, 1)} STX`}
            secondary={tr("in.per1Sbtc")} accent="var(--accent-2)" />
        </div>
      </MotionCard>

      {spotStxPerSbtc && basisVsSpotPct !== null && (
        <MotionCard disableHover>
          <div className="glass-card rounded-2xl p-5"
            style={{ ['--card-accent' as string]: basisVsSpotPct >= 0 ? '#00C27A' : '#F04A6E' }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: basisVsSpotPct >= 0
                      ? 'color-mix(in srgb, #00C27A 18%, transparent)'
                      : 'color-mix(in srgb, #F04A6E 18%, transparent)',
                  }}>
                  {basisVsSpotPct >= 0
                    ? <TrendingDown size={16} style={{ color: '#00C27A' }} />
                    : <TrendingUp size={16} style={{ color: '#F04A6E' }} />}
                </div>
                <div>
                  <h2 className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    {tr("in.basisVsSpot")}
                    <button
                      type="button"
                      title={tr("in.basisVsSpotInfo")}
                      aria-label={tr("in.basisVsSpotAria")}
                      className="inline-flex items-center focus:outline-none focus-visible:ring-2 rounded"
                    >
                      <Info size={12} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
                    </button>
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {tr.rich("in.spotLine", {
                      spot: formatStx(spotStxPerSbtc, 0),
                      avg: formatStx(totals.avgStxPerSbtc, 0),
                      b: (c) => <span className="font-data font-semibold" style={{ color: 'var(--text-primary)' }}>{c}</span>,
                    })}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold font-data"
                  style={{ color: basisVsSpotPct >= 0 ? '#00C27A' : '#F04A6E', letterSpacing: '-0.02em' }}>
                  {basisVsSpotPct >= 0 ? '+' : ''}{basisVsSpotPct.toFixed(1)}%
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {basisVsSpotPct >= 0 ? tr("in.cheaperThanSpot") : tr("in.aboveSpot")}
                </p>
              </div>
            </div>
          </div>
        </MotionCard>
      )}

      {lumpSumAggregate ? (
        <MotionCard disableHover>
          <div className="glass-card rounded-2xl p-5"
            style={{ ['--card-accent' as string]: lumpSumAggregate.deltaPct >= 0 ? '#00C27A' : '#F04A6E' }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: lumpSumAggregate.deltaPct >= 0
                      ? 'color-mix(in srgb, #00C27A 18%, transparent)'
                      : 'color-mix(in srgb, #F04A6E 18%, transparent)',
                  }}>
                  <BarChart3 size={16} style={{ color: lumpSumAggregate.deltaPct >= 0 ? '#00C27A' : '#F04A6E' }} />
                </div>
                <div>
                  <h2 className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    {tr("in.dcaVsLump")}
                    <button
                      type="button"
                      title={tr("in.dcaVsLumpInfo")}
                      aria-label={tr("in.dcaVsLumpAria")}
                      className="inline-flex items-center focus:outline-none focus-visible:ring-2 rounded"
                    >
                      <Info size={12} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
                    </button>
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {tr.rich("in.lumpSummary", {
                      count: lumpSumAggregate.count,
                      actual: formatSbtc(lumpSumAggregate.sumActualSbtc),
                      lump: formatSbtc(lumpSumAggregate.sumLumpSbtc),
                      b: (c) => <span className="font-data font-semibold" style={{ color: 'var(--text-primary)' }}>{c}</span>,
                    })}
                  </p>
                  {lumpSumAggregate.skipped > 0 && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {tr("in.lumpExcluded", { count: lumpSumAggregate.skipped })}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold font-data"
                  style={{ color: lumpSumAggregate.deltaPct >= 0 ? '#00C27A' : '#F04A6E', letterSpacing: '-0.02em' }}>
                  {lumpSumAggregate.deltaPct >= 0 ? '+' : ''}{lumpSumAggregate.deltaPct.toFixed(1)}%
                </p>
                <p className="text-[11px] font-data" style={{ color: 'var(--text-muted)' }}>
                  {tr("in.deltaVsLump", { delta: `${lumpSumAggregate.deltaSbtc >= 0 ? '+' : ''}${formatSbtc(Math.abs(lumpSumAggregate.deltaSbtc))}` })}
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
          <div className="glass-card rounded-2xl p-5" style={{ ['--card-accent' as string]: 'var(--text-muted)' }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <BarChart3 size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{tr("in.lumpUnavailableTitle")}</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {tr("in.lumpUnavailableDesc")}
                </p>
              </div>
            </div>
          </div>
        </MotionCard>
      ) : null}

      <MotionCard disableHover>
        <CostBasisChart perPlan={perPlan} />
      </MotionCard>

      <MotionCard disableHover>
        <div className="glass-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{tr("common.perPlanBreakdown")}</h2>
          <div className="space-y-3">
            {perPlan
              .filter((p) => p.perf.executionCount > 0)
              .sort((a, b) => b.perf.totalStxIn - a.perf.totalStxIn)
              .map(({ plan, perf, lumpSum }) => (
                <PlanRow key={plan.id} plan={plan} perf={perf}
                  stxUsd={stx?.price ?? 0} btcUsd={btcUsd ?? 0} lumpSum={lumpSum ?? null} />
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

function PlanRow({ plan, perf, stxUsd, btcUsd, lumpSum }:
  { plan: DCAPlan; perf: PlanPerformance; stxUsd: number; btcUsd: number; lumpSum: LumpSumScenario | null }) {
  const tr = useTranslations("dca.perf");
  const ti = useTranslations("dca.interval");
  const planStxValueUsd = stxUsd ? perf.totalStxIn * stxUsd : null;
  const planSbtcValueUsd = btcUsd ? perf.totalSbtcOut * btcUsd : null;
  const cadenceRaw = blocksToInterval(plan.ivl);
  const cadence = (["Daily", "Weekly", "Monthly"] as const).includes(cadenceRaw as "Daily" | "Weekly" | "Monthly")
    ? ti(cadenceRaw)
    : cadenceRaw;

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md font-data"
            style={{
              backgroundColor: plan.active ? 'color-mix(in srgb, #00C27A 14%, transparent)' : 'var(--border-subtle)',
              color: plan.active ? '#00C27A' : 'var(--text-muted)',
            }}>
            {tr("common.planNumber", { id: plan.id })}
          </span>
          <span className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{tr("common.everyCadence", { cadence })}</span>
          {!plan.active && (
            <span className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{tr("common.completed")}</span>
          )}
        </div>
        <span className="text-[11px] font-data" style={{ color: 'var(--text-muted)' }}>
          {formatDate(perf.firstExecutionAt ?? 0)} → {formatDate(perf.lastExecutionAt ?? 0)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Cell label={tr("common.executions")} value={perf.executionCount.toString()} />
        <Cell label={tr("in.cellStxIn")} value={`${formatStx(perf.totalStxIn)}`}
          sub={planStxValueUsd !== null ? formatUSD(planStxValueUsd) : undefined} />
        <Cell label={tr("in.cellSbtcOut")} value={formatSbtc(perf.totalSbtcOut)} sub={tr("in.satsSub", { sats: formatSats(perf.totalSbtcOut) })} />
        <Cell label={tr("in.cellAvgCost")} value={`${formatStx(perf.avgStxPerSbtc, 0)} STX/sBTC`}
          sub={planSbtcValueUsd !== null ? tr("in.nowSub", { usd: formatUSD(planSbtcValueUsd) }) : undefined} />
      </div>

      {lumpSum && (
        <div className="mt-3 pt-3 flex items-center justify-between flex-wrap gap-2"
          style={{ borderTop: '1px dashed var(--border-subtle)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="font-semibold uppercase tracking-wider" style={{ letterSpacing: '0.08em' }}>{tr("in.vsLumpLabel")}</span>
            {' '}{tr.rich("in.vsLumpDetail", {
              date: formatDate(new Date(lumpSum.referenceDate + 'T00:00:00Z').getTime() / 1000),
              sbtc: formatSbtc(lumpSum.lumpSumSbtc),
              b: (c) => <span className="font-data" style={{ color: 'var(--text-secondary)' }}>{c}</span>,
            })}
          </p>
          <span className="text-[11px] font-data font-bold px-2 py-0.5 rounded-md"
            style={{
              color: lumpSum.deltaPct >= 0 ? '#00C27A' : '#F04A6E',
              backgroundColor: lumpSum.deltaPct >= 0
                ? 'color-mix(in srgb, #00C27A 14%, transparent)'
                : 'color-mix(in srgb, #F04A6E 14%, transparent)',
            }}>
            {lumpSum.deltaPct >= 0 ? '+' : ''}{lumpSum.deltaPct.toFixed(1)}%
          </span>
        </div>
      )}

      {perf.successfulEvents.length > 0 && (
        <Link href={`https://explorer.hiro.so/txid/${perf.successfulEvents[perf.successfulEvents.length - 1].txId}?chain=mainnet`}
          target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
          style={{ color: 'var(--accent-2)' }}>
          {tr("common.latestExecution")} <ExternalLink size={10} />
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
