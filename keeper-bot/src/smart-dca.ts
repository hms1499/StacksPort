// keeper-bot/src/smart-dca.ts
// Pure decision logic for Smart DCA ("buy the dip"). No IO here — see
// smart-dca-store.ts (Redis) and smart-dca-signal.ts (CoinGecko).

import type { BatchPlan } from "./batch-executor.js";

export interface SmartDcaConfig {
  owner: string;
  thresholdBps: number;       // e.g. 500 = 5.00% above the N-day average
  windowDays: number;         // SMA window, 1..30
  maxDeferIntervals: number;  // skip at most K keeper runs before a market buy
  createdAt: number;          // unix seconds
}

export interface SatsPerStxSignal {
  current: number;            // current sats per 1 STX
  series: number[];           // daily sats/STX, oldest → newest
}

export type DipAction = "execute" | "skip";

export interface DipDecision {
  action: DipAction;
  reason: string;
  nextDefer: number;          // defer counter to persist after this decision
}

// sats/STX = (STX_USD / BTC_USD) * 1e8, element-wise over aligned daily series.
// Skips any index where BTC price is 0 or inputs are missing.
export function computeSatsPerStxSeries(
  stxUsd: number[],
  btcUsd: number[]
): number[] {
  const n = Math.min(stxUsd.length, btcUsd.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = stxUsd[i];
    const b = btcUsd[i];
    if (!(b > 0) || !(s >= 0)) continue;
    out.push((s / b) * 1e8);
  }
  return out;
}

// Average of the last `windowDays` values. If the series is shorter, averages
// what exists. Returns 0 for an empty series (caller treats 0 as "no signal").
export function sma(series: number[], windowDays: number): number {
  if (series.length === 0) return 0;
  const w = Math.max(1, Math.min(windowDays, series.length));
  const slice = series.slice(series.length - w);
  const total = slice.reduce((acc, v) => acc + v, 0);
  return total / slice.length;
}

// Core per-plan decision. `current` and `avg` are sats/STX; `current > avg` means
// STX buys more sats than usual (a good entry).
export function evaluateDipCondition(args: {
  current: number;
  avg: number;
  thresholdBps: number;
  deferCount: number;
  maxDeferIntervals: number;
}): DipDecision {
  const { current, avg, thresholdBps, deferCount, maxDeferIntervals } = args;

  // No usable signal → fail-open: execute as a normal DCA, reset counter.
  if (!(avg > 0) || !(current > 0)) {
    return { action: "execute", reason: "no-signal-fail-open", nextDefer: 0 };
  }

  const premium = current / avg - 1;
  if (premium >= thresholdBps / 10_000) {
    return { action: "execute", reason: "dip-hit", nextDefer: 0 };
  }

  if (deferCount + 1 > maxDeferIntervals) {
    return { action: "execute", reason: "defer-cap-market-buy", nextDefer: 0 };
  }

  return { action: "skip", reason: "below-threshold", nextDefer: deferCount + 1 };
}

// Decide which due plans go into the batch. Only vault-0 plans with a config are
// gated; everything else passes through unchanged (backward compatible).
export function decideBatch(args: {
  plans: BatchPlan[];
  configs: Map<number, SmartDcaConfig>;
  deferByPlan: Map<number, number>;
  signal: SatsPerStxSignal | null;
}): {
  toExecute: BatchPlan[];
  deferWrites: Map<number, number>; // planId → new defer value to persist
  reasons: Map<number, string>;     // planId → decision.reason (gated plans only)
} {
  const { plans, configs, deferByPlan, signal } = args;
  const toExecute: BatchPlan[] = [];
  const deferWrites = new Map<number, number>();
  const reasons = new Map<number, string>();

  for (const plan of plans) {
    const cfg = plan.vaultType === 0 ? configs.get(plan.planId) : undefined;
    if (!cfg) {
      toExecute.push(plan);
      continue;
    }

    const avg = signal ? sma(signal.series, cfg.windowDays) : 0;
    const decision = evaluateDipCondition({
      current: signal?.current ?? 0,
      avg,
      thresholdBps: cfg.thresholdBps,
      deferCount: deferByPlan.get(plan.planId) ?? 0,
      maxDeferIntervals: cfg.maxDeferIntervals,
    });

    deferWrites.set(plan.planId, decision.nextDefer);
    reasons.set(plan.planId, decision.reason);
    if (decision.action === "execute") toExecute.push(plan);
  }

  return { toExecute, deferWrites, reasons };
}
