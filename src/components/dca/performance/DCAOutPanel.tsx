"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import useSWR from "swr";
import {
  Activity, Bitcoin, BarChart3, TrendingUp, TrendingDown,
  Info, ExternalLink, DollarSign, Wallet, Coins,
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
import {
  getAllStxUsdcxUserPlans,
  getStxUsdcxPlanExecutionHistory,
  aggregateStxUsdcxPlanPerformance,
  type StxUsdcxPlan,
  type StxUsdcxPerformance,
} from "@/lib/dca-stx-usdcx";
import { batchedMap } from "@/lib/dca";
import { getBtcUsdPrice, getSTXPrice } from "@/lib/stacks";
import { formatUSD } from "@/lib/utils";
import CostBasisOutChart from "./CostBasisOutChart";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function formatNum(n: number, dp = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function formatDate(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
function formatSbtc(n: number): string {
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.01) return n.toFixed(5);
  return n.toFixed(8);
}

// USDCx ≈ $1 for v1; mirrors the rest of the Out work.
const TOKEN_USD = 1;
const TOKEN_LABEL = "USDCx";

// ─── Source tab ────────────────────────────────────────────────────────────────

type OutSource = "sbtc" | "stx";

// ─── sBTC Out section ──────────────────────────────────────────────────────────

interface SbtcPlanWithPerf {
  plan: DCA_SBTCPlan;
  perf: SBTCPlanPerformance;
}

function SbtcOutSection({
  isConnected,
  stxAddress,
  btcUsd,
}: {
  isConnected: boolean;
  stxAddress: string | null;
  btcUsd: number | undefined;
}) {
  const tr = useTranslations("dca.perf");

  const { data: planBundle, isLoading: plansLoading } = useSWR(
    isConnected && stxAddress ? ["sbtc-all-plans", stxAddress] : null,
    () => getAllSBTCUserPlans(stxAddress!),
    { dedupingInterval: 30_000 }
  );

  const allPlans = useMemo(() => {
    if (!planBundle) return [] as DCA_SBTCPlan[];
    return [...planBundle.active, ...planBundle.completed];
  }, [planBundle]);

  const [perPlan, setPerPlan] = useState<SbtcPlanWithPerf[] | null>(null);
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
          const events = await getSBTCPlanExecutionHistory(plan.id, plan.token, 100, plan.owner);
          return { plan, perf: aggregateSBTCPlanPerformance(plan.id, events) };
        } catch {
          return { plan, perf: aggregateSBTCPlanPerformance(plan.id, []) };
        }
      }, 5);
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
        sbtcIn: acc.sbtcIn + perf.totalSbtcIn / 1e8,
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
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{tr("out.noPlans")}</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{tr("out.noPlansDesc")}</p>
          <Link href="/dca?direction=out"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "#000" }}>
            {tr("out.createPlan")}
          </Link>
        </div>
      </MotionCard>
    );
  }
  if (totals && totals.executions === 0) {
    return (
      <MotionCard disableHover>
        <div className="glass-card rounded-2xl p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{tr("common.noExecutions")}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{tr("out.noExecDesc")}</p>
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
            <span className="text-[11px] font-data" style={{ color: "var(--text-muted)" }}>
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
          <SummaryCard icon={<Bitcoin size={13} />} label={tr("out.sbtcInvested")}
            primary={`${formatSbtc(totals.sbtcIn)} sBTC`}
            secondary={btcUsd ? tr("common.atSpot", { value: formatUSD(totals.sbtcIn * btcUsd) }) : "—"}
            accent="#F7931A" />
          <SummaryCard icon={<DollarSign size={13} />} label={tr("out.tokenReceived", { token: TOKEN_LABEL })}
            primary={`${formatNum(totals.tokenOut)} ${TOKEN_LABEL}`}
            secondary={`${formatUSD(totals.tokenOut * TOKEN_USD)}`}
            accent="#00C27A" />
          <SummaryCard icon={<BarChart3 size={13} />} label={tr("out.avgSellRate")}
            primary={`${formatNum(totals.avgTokenPerSbtc, 0)} ${TOKEN_LABEL}`}
            secondary={tr("out.per1Sbtc")} accent="#A78BFA" />
        </div>
      </MotionCard>

      {spotTokenPerSbtc && sellVsSpotPct !== null && (
        <MotionCard disableHover>
          <div className="glass-card rounded-2xl p-5"
            style={{ ["--card-accent" as string]: sellVsSpotPct >= 0 ? "#00C27A" : "#F04A6E" }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: sellVsSpotPct >= 0
                      ? "color-mix(in srgb, #00C27A 18%, transparent)"
                      : "color-mix(in srgb, #F04A6E 18%, transparent)",
                  }}>
                  {sellVsSpotPct >= 0
                    ? <TrendingUp size={16} style={{ color: "#00C27A" }} />
                    : <TrendingDown size={16} style={{ color: "#F04A6E" }} />}
                </div>
                <div>
                  <h2 className="font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                    {tr("out.sellVsSpot")}
                    <button type="button" title={tr("out.sellVsSpotInfo")} aria-label={tr("out.sellVsSpotAria")}
                      className="inline-flex items-center focus:outline-none focus-visible:ring-2 rounded">
                      <Info size={12} style={{ color: "var(--text-muted)", cursor: "help" }} />
                    </button>
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {tr.rich("out.spotLine", {
                      spot: formatNum(spotTokenPerSbtc, 0),
                      avg: formatNum(totals.avgTokenPerSbtc, 0),
                      token: TOKEN_LABEL,
                      b: (c) => <span className="font-data font-semibold" style={{ color: "var(--text-primary)" }}>{c}</span>,
                    })}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold font-data"
                  style={{ color: sellVsSpotPct >= 0 ? "#00C27A" : "#F04A6E", letterSpacing: "-0.02em" }}>
                  {sellVsSpotPct >= 0 ? "+" : ""}{sellVsSpotPct.toFixed(1)}%
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {sellVsSpotPct >= 0 ? tr("out.soldAboveSpot") : tr("out.soldBelowSpot")}
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
          <h2 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{tr("common.perPlanBreakdown")}</h2>
          <div className="space-y-3">
            {perPlan
              .filter((p) => p.perf.executionCount > 0)
              .sort((a, b) => b.perf.totalSbtcIn - a.perf.totalSbtcIn)
              .map(({ plan, perf }) => (
                <SbtcPlanRow key={plan.id} plan={plan} perf={perf} btcUsd={btcUsd ?? 0} />
              ))}
          </div>
        </div>
      </MotionCard>
    </>
  );
}

// ─── STX Out section ────────────────────────────────────────────────────────────

interface StxPlanWithPerf {
  plan: StxUsdcxPlan;
  perf: StxUsdcxPerformance;
}

/**
 * Adapt StxUsdcxPerformance to the SBTCPlanPerformance shape that CostBasisOutChart expects.
 * The chart divides `sbtcIn` by 1e8 to get source-token units; uSTX uses 1e6, so we
 * multiply stxIn by 100 so that `(stxIn * 100) / 1e8 = stxIn / 1e6 = STX`.
 */
function adaptStxPerfForChart(p: StxPlanWithPerf): SbtcPlanWithPerf {
  const adaptedEvents = p.perf.successfulEvents.map((e) => ({
    txId: e.txId,
    blockHeight: e.blockHeight,
    blockTime: e.blockTime,
    status: e.status as "success",
    sbtcIn: (e.stxIn ?? 0) * 100,  // scale: (stxIn * 100) / 1e8 = stxIn / 1e6 = STX amount
    tokenOut: e.tokenOut,
    targetTokenContract: e.targetTokenContract,
  }));

  const adaptedPerf: SBTCPlanPerformance = {
    planId: p.perf.planId,
    executionCount: p.perf.executionCount,
    totalSbtcIn: p.perf.totalStxIn * 100,
    totalTokenOut: p.perf.totalTokenOut,
    avgSbtcPerToken: p.perf.avgStxPerToken * 100,
    avgTokenPerSbtc: p.perf.avgTokenPerStx,
    firstExecutionAt: p.perf.firstExecutionAt,
    lastExecutionAt: p.perf.lastExecutionAt,
    successfulEvents: adaptedEvents,
    targetTokenContract: p.perf.targetTokenContract,
    targetTokenDecimals: p.perf.targetTokenDecimals,
  };

  // Fake a minimal DCA_SBTCPlan for the plan row (only fields used in the row are needed)
  const fakePlan = p.plan as unknown as DCA_SBTCPlan;

  return { plan: fakePlan, perf: adaptedPerf };
}

function StxOutSection({
  isConnected,
  stxAddress,
  stxUsd,
}: {
  isConnected: boolean;
  stxAddress: string | null;
  stxUsd: number | undefined;
}) {
  const tr = useTranslations("dca.perf");

  const { data: planBundle, isLoading: plansLoading } = useSWR(
    isConnected && stxAddress ? ["stx-usdcx-all-plans", stxAddress] : null,
    () => getAllStxUsdcxUserPlans(stxAddress!),
    { dedupingInterval: 30_000 }
  );

  const allPlans = useMemo(() => {
    if (!planBundle) return [] as StxUsdcxPlan[];
    return [...planBundle.active, ...planBundle.completed];
  }, [planBundle]);

  const [perPlan, setPerPlan] = useState<StxPlanWithPerf[] | null>(null);
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
          const events = await getStxUsdcxPlanExecutionHistory(plan.id, plan.token, 100, plan.owner);
          return { plan, perf: aggregateStxUsdcxPlanPerformance(plan.id, events) };
        } catch {
          return { plan, perf: aggregateStxUsdcxPlanPerformance(plan.id, []) };
        }
      }, 5);
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
        stxIn: acc.stxIn + perf.totalStxIn / 1e6,
        tokenOut: acc.tokenOut + perf.totalTokenOut,
      }),
      { executions: 0, stxIn: 0, tokenOut: 0 }
    );
    const avgTokenPerStx = t.stxIn > 0 ? t.tokenOut / t.stxIn : 0;
    return { ...t, avgTokenPerStx };
  }, [perPlan]);

  // Spot: USDCx per STX ≈ stxUsd (since USDCx ≈ $1, STX price in USD ≈ USDCx per STX)
  const spotTokenPerStx = stxUsd && stxUsd > 0 ? stxUsd / TOKEN_USD : null;
  const sellVsSpotPct =
    totals && spotTokenPerStx && totals.avgTokenPerStx > 0
      ? ((totals.avgTokenPerStx - spotTokenPerStx) / spotTokenPerStx) * 100
      : null;

  const adaptedForChart = useMemo(
    () => (perPlan ?? []).map((p) => adaptStxPerfForChart(p)),
    [perPlan],
  );

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
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{tr("out.stxNoPlans")}</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{tr("out.stxNoPlansDesc")}</p>
          <Link href="/dca?direction=out"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "#000" }}>
            {tr("out.createPlan")}
          </Link>
        </div>
      </MotionCard>
    );
  }
  if (totals && totals.executions === 0) {
    return (
      <MotionCard disableHover>
        <div className="glass-card rounded-2xl p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{tr("common.noExecutions")}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{tr("out.stxNoExecDesc")}</p>
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
            <span className="text-[11px] font-data" style={{ color: "var(--text-muted)" }}>
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
          <SummaryCard icon={<Coins size={13} />} label={tr("out.stxInvested")}
            primary={`${formatNum(totals.stxIn)} STX`}
            secondary={stxUsd ? tr("common.atSpot", { value: formatUSD(totals.stxIn * stxUsd) }) : "—"}
            accent="#7B3FE4" />
          <SummaryCard icon={<DollarSign size={13} />} label={tr("out.tokenReceived", { token: TOKEN_LABEL })}
            primary={`${formatNum(totals.tokenOut)} ${TOKEN_LABEL}`}
            secondary={`${formatUSD(totals.tokenOut * TOKEN_USD)}`}
            accent="#00C27A" />
          <SummaryCard icon={<BarChart3 size={13} />} label={tr("out.stxAvgSellRate")}
            primary={`${formatNum(totals.avgTokenPerStx, 4)} ${TOKEN_LABEL}`}
            secondary={tr("out.stxPer1Stx")} accent="#A78BFA" />
        </div>
      </MotionCard>

      {spotTokenPerStx && sellVsSpotPct !== null && (
        <MotionCard disableHover>
          <div className="glass-card rounded-2xl p-5"
            style={{ ["--card-accent" as string]: sellVsSpotPct >= 0 ? "#00C27A" : "#F04A6E" }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: sellVsSpotPct >= 0
                      ? "color-mix(in srgb, #00C27A 18%, transparent)"
                      : "color-mix(in srgb, #F04A6E 18%, transparent)",
                  }}>
                  {sellVsSpotPct >= 0
                    ? <TrendingUp size={16} style={{ color: "#00C27A" }} />
                    : <TrendingDown size={16} style={{ color: "#F04A6E" }} />}
                </div>
                <div>
                  <h2 className="font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                    {tr("out.stxSellVsSpot")}
                    <button type="button" title={tr("out.stxSellVsSpotInfo")} aria-label={tr("out.stxSellVsSpotAria")}
                      className="inline-flex items-center focus:outline-none focus-visible:ring-2 rounded">
                      <Info size={12} style={{ color: "var(--text-muted)", cursor: "help" }} />
                    </button>
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {tr.rich("out.stxSpotLine", {
                      spot: formatNum(spotTokenPerStx, 4),
                      avg: formatNum(totals.avgTokenPerStx, 4),
                      token: TOKEN_LABEL,
                      b: (c) => <span className="font-data font-semibold" style={{ color: "var(--text-primary)" }}>{c}</span>,
                    })}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold font-data"
                  style={{ color: sellVsSpotPct >= 0 ? "#00C27A" : "#F04A6E", letterSpacing: "-0.02em" }}>
                  {sellVsSpotPct >= 0 ? "+" : ""}{sellVsSpotPct.toFixed(1)}%
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {sellVsSpotPct >= 0 ? tr("out.soldAboveSpot") : tr("out.soldBelowSpot")}
                </p>
              </div>
            </div>
          </div>
        </MotionCard>
      )}

      <MotionCard disableHover>
        {/* Reuse CostBasisOutChart with STX-denominated series (stxIn scaled × 100 so
            chart's /1e8 gives correct STX units: stxIn_uSTX × 100 / 1e8 = stxIn_uSTX / 1e6 = STX) */}
        <CostBasisOutChart perPlan={adaptedForChart} />
      </MotionCard>

      <MotionCard disableHover>
        <div className="glass-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h2 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{tr("common.perPlanBreakdown")}</h2>
          <div className="space-y-3">
            {perPlan
              .filter((p) => p.perf.executionCount > 0)
              .sort((a, b) => b.perf.totalStxIn - a.perf.totalStxIn)
              .map(({ plan, perf }) => (
                <StxPlanRow key={plan.id} plan={plan} perf={perf} stxUsd={stxUsd ?? 0} />
              ))}
          </div>
        </div>
      </MotionCard>
    </>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export default function DCAOutPanel({
  isConnected, stxAddress,
}: { isConnected: boolean; stxAddress: string | null }) {
  const tr = useTranslations("dca.perf");
  const [source, setSource] = useState<OutSource>("sbtc");

  const { data: btcUsd } = useSWR<number>("btc-usd-spot", getBtcUsdPrice, {
    refreshInterval: 60_000, dedupingInterval: 60_000,
  });

  const { data: stxPriceData } = useSWR(
    "stx-price",
    () => getSTXPrice().catch(() => undefined),
    { refreshInterval: 60_000, dedupingInterval: 60_000 }
  );
  const stxUsd = stxPriceData?.usd;

  if (!isConnected) {
    return (
      <MotionCard disableHover>
        <div className="glass-card rounded-2xl" style={{ boxShadow: "var(--shadow-card)" }}>
          <EmptyState
            icon={<Wallet size={28} style={{ color: "var(--accent-text)" }} />}
            title={tr("common.connectTitle")}
            description={tr("out.connectDesc")}
            action={<ConnectWalletCTA />}
          />
        </div>
      </MotionCard>
    );
  }

  return (
    <>
      {/* Source toggle */}
      <MotionCard disableHover>
        <div
          className="inline-flex gap-1 p-1 rounded-2xl"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
          role="tablist"
          aria-label={tr("out.sourceAria")}
        >
          {([
            { key: "sbtc" as OutSource, labelKey: "out.sourceSbtc", icon: Bitcoin },
            { key: "stx"  as OutSource, labelKey: "out.sourceStx",  icon: Coins  },
          ] as const).map(({ key, labelKey, icon: Icon }) => {
            const active = source === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setSource(key)}
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-sm font-medium transition-all"
                style={
                  active
                    ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "var(--shadow-card)" }
                    : { color: "var(--text-muted)", opacity: 0.8 }
                }
              >
                <Icon size={14} />
                <span>{tr(labelKey)}</span>
              </button>
            );
          })}
        </div>
      </MotionCard>

      {source === "sbtc" ? (
        <SbtcOutSection isConnected={isConnected} stxAddress={stxAddress} btcUsd={btcUsd} />
      ) : (
        <StxOutSection isConnected={isConnected} stxAddress={stxAddress} stxUsd={stxUsd} />
      )}
    </>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────────

function SummaryCard({ icon, label, primary, secondary, accent }:
  { icon: React.ReactNode; label: string; primary: string; secondary: string; accent: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="glass-card rounded-2xl p-4"
      style={{ ["--card-accent" as string]: accent, boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: accent }}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ letterSpacing: "0.08em" }}>{label}</span>
      </div>
      <p className="text-base font-bold font-data leading-tight" style={{ color: "var(--text-primary)" }}>{primary}</p>
      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{secondary}</p>
    </motion.div>
  );
}

function SbtcPlanRow({ plan, perf, btcUsd }:
  { plan: DCA_SBTCPlan; perf: SBTCPlanPerformance; btcUsd: number }) {
  const tr = useTranslations("dca.perf");
  const ti = useTranslations("dca.interval");
  const sbtc = perf.totalSbtcIn / 1e8;
  const sbtcUsd = btcUsd ? sbtc * btcUsd : null;
  const tokenUsd = perf.totalTokenOut * TOKEN_USD;
  const cadenceRaw = blocksToInterval(plan.ivl);
  const cadence = (["Daily", "Weekly", "Monthly"] as const).includes(cadenceRaw as "Daily" | "Weekly" | "Monthly")
    ? ti(cadenceRaw)
    : cadenceRaw;

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md font-data"
            style={{
              backgroundColor: plan.active ? "color-mix(in srgb, #00C27A 14%, transparent)" : "var(--border-subtle)",
              color: plan.active ? "#00C27A" : "var(--text-muted)",
            }}>
            {tr("common.planNumber", { id: plan.id })}
          </span>
          <span className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>{tr("common.everyCadence", { cadence })}</span>
          {!plan.active && (
            <span className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>{tr("common.completed")}</span>
          )}
        </div>
        <span className="text-[11px] font-data" style={{ color: "var(--text-muted)" }}>
          {formatDate(perf.firstExecutionAt ?? 0)} → {formatDate(perf.lastExecutionAt ?? 0)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Cell label={tr("common.executions")} value={perf.executionCount.toString()} />
        <Cell label={tr("out.cellSbtcIn")} value={formatSbtc(sbtc)}
          sub={sbtcUsd !== null ? formatUSD(sbtcUsd) : undefined} />
        <Cell label={tr("out.cellTokenOut", { token: TOKEN_LABEL })} value={formatNum(perf.totalTokenOut)}
          sub={formatUSD(tokenUsd)} />
        <Cell label={tr("out.cellAvgRate")} value={tr("out.avgRateValue", { rate: formatNum(perf.avgTokenPerSbtc, 0), token: TOKEN_LABEL })} />
      </div>

      {perf.successfulEvents.length > 0 && (
        <Link href={`https://explorer.hiro.so/txid/${perf.successfulEvents[perf.successfulEvents.length - 1].txId}?chain=mainnet`}
          target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
          style={{ color: "var(--accent-text)" }}>
          {tr("common.latestExecution")} <ExternalLink size={10} />
        </Link>
      )}
    </div>
  );
}

function StxPlanRow({ plan, perf, stxUsd }:
  { plan: StxUsdcxPlan; perf: StxUsdcxPerformance; stxUsd: number }) {
  const tr = useTranslations("dca.perf");
  const ti = useTranslations("dca.interval");
  const stxAmount = perf.totalStxIn / 1e6;
  const stxUsdValue = stxUsd ? stxAmount * stxUsd : null;
  const tokenUsd = perf.totalTokenOut * TOKEN_USD;
  const cadenceRaw = blocksToInterval(plan.ivl);
  const cadence = (["Daily", "Weekly", "Monthly"] as const).includes(cadenceRaw as "Daily" | "Weekly" | "Monthly")
    ? ti(cadenceRaw)
    : cadenceRaw;

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md font-data"
            style={{
              backgroundColor: plan.active ? "color-mix(in srgb, #00C27A 14%, transparent)" : "var(--border-subtle)",
              color: plan.active ? "#00C27A" : "var(--text-muted)",
            }}>
            {tr("common.planNumber", { id: plan.id })}
          </span>
          <span className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>{tr("common.everyCadence", { cadence })}</span>
          {!plan.active && (
            <span className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>{tr("common.completed")}</span>
          )}
        </div>
        <span className="text-[11px] font-data" style={{ color: "var(--text-muted)" }}>
          {formatDate(perf.firstExecutionAt ?? 0)} → {formatDate(perf.lastExecutionAt ?? 0)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Cell label={tr("common.executions")} value={perf.executionCount.toString()} />
        <Cell label={tr("out.stxCellStxIn")} value={`${formatNum(stxAmount)} STX`}
          sub={stxUsdValue !== null ? formatUSD(stxUsdValue) : undefined} />
        <Cell label={tr("out.cellTokenOut", { token: TOKEN_LABEL })} value={formatNum(perf.totalTokenOut)}
          sub={formatUSD(tokenUsd)} />
        <Cell label={tr("out.cellAvgRate")} value={tr("out.stxAvgRateValue", { rate: formatNum(perf.avgTokenPerStx, 4), token: TOKEN_LABEL })} />
      </div>

      {perf.successfulEvents.length > 0 && (
        <Link href={`https://explorer.hiro.so/txid/${perf.successfulEvents[perf.successfulEvents.length - 1].txId}?chain=mainnet`}
          target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
          style={{ color: "var(--accent-text)" }}>
          {tr("common.latestExecution")} <ExternalLink size={10} />
        </Link>
      )}
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>{label}</p>
      <p className="font-data font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-[10px] font-data mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}
