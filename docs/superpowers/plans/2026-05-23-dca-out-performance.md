# DCA Out coverage on `/dca/performance` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/dca/performance` with a tab split — preserve current STX→sBTC view byte-identical behind a "DCA In" tab, add a new "DCA Out" tab covering the sBTC→USDCx vault (`dca-vault-sbtc-v2`).

**Architecture:** Page-level `activeTab` React state in `DCAPerformanceContent.tsx`; the current body is extracted into `DCAInPanel.tsx` unchanged; a new `DCAOutPanel.tsx` mirrors that structure with Out-specific math (no lump-sum, no 90-day chart). Library helpers (`getSBTCPlanExecutionHistory`, `aggregateSBTCPlanPerformance`, `getAllSBTCUserPlans`) are added to `src/lib/dca-sbtc.ts` mirroring the In-side helpers in `src/lib/dca.ts`. Out data is fetched lazily — only when the user actually selects the Out tab — to stay gentle on the Hiro API.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, SWR, Tailwind, lucide-react icons, vitest for unit tests, Hiro REST API for on-chain reads.

**Spec:** [docs/superpowers/specs/2026-05-23-dca-out-performance-design.md](../specs/2026-05-23-dca-out-performance-design.md)

---

## File Structure

**Create:**
- `src/components/dca/performance/DCAInPanel.tsx` — extracted (no behaviour change)
- `src/components/dca/performance/DCAOutPanel.tsx` — new Out panel
- `src/components/dca/performance/PerformanceTabs.tsx` — 2-button tab nav
- `src/lib/dca-sbtc.test.ts` — unit tests for `aggregateSBTCPlanPerformance`

**Modify:**
- `src/lib/dca-sbtc.ts` — add `SBTCPlanExecutionEvent`, `getSBTCPlanExecutionHistory`, `SBTCPlanPerformance`, `aggregateSBTCPlanPerformance`, `getAllSBTCUserPlans`
- `src/components/dca/performance/DCAPerformanceContent.tsx` — becomes thin wrapper with tabs

---

### Task 1: Library — event scanner skeleton + types

**Files:**
- Modify: `src/lib/dca-sbtc.ts` (append after existing `getSBTCBalance` around line 247)

- [ ] **Step 1: Verify contract `tx_result` shape**

Open a real `execute-dca` tx on `dca-vault-sbtc-v2` via Hiro explorer or curl:

```bash
curl -s "https://api.hiro.so/extended/v1/address/SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2/transactions_with_transfers?limit=10" | jq '.results[] | select(.tx.contract_call.function_name=="execute-dca") | .tx.tx_result.repr' | head -3
```

Expected: a string like `(ok (tuple (bal-remaining u...) (net-swapped u...) (protocol-fee u...) (swaps-done u...)))` — same shape as the In contract. If different, note the actual keys and adjust regex below.

- [ ] **Step 2: Add types + parser + scanner**

Append to `src/lib/dca-sbtc.ts`:

```ts
// ─── Execution history ────────────────────────────────────────────────────────

export interface SBTCPlanExecutionEvent {
  txId: string;
  blockHeight: number;
  blockTime: number; // unix seconds; 0 if pending
  status: "success" | "pending" | "failed";
  /** sBTC sats actually swapped (from tx_result net-swapped). */
  sbtcIn?: number;
  /** micro-STX fee (gas leg paid in STX). */
  protocolFeeStx?: number;
  /** Target-token base units credited to the plan owner in this tx,
   *  extracted from ft_transfers filtered by the plan's target contract.
   *  Undefined for non-success or when the asset did not appear. */
  tokenOut?: number;
  /** The asset-id prefix used to match ft_transfers (e.g. "SP120...usdcx"). */
  targetTokenContract?: string;
}

function parseSBTCExecuteResult(repr: string | undefined): {
  sbtcIn?: number;
  protocolFeeStx?: number;
} {
  if (!repr) return {};
  const net = repr.match(/net-swapped u(\d+)/);
  const fee = repr.match(/protocol-fee u(\d+)/);
  return {
    sbtcIn: net ? Number(net[1]) : undefined,
    protocolFeeStx: fee ? Number(fee[1]) : undefined,
  };
}

/**
 * Fetch recent `execute-dca` transactions on the sBTC vault for one plan.
 * Mirrors `getPlanExecutionHistory` in dca.ts but scoped to dca-vault-sbtc-v2.
 *
 * `targetTokenContract` is the plan.token value (e.g. "SP120...usdcx"); the
 * scanner filters ft_transfers by `asset_identifier` starting with that.
 */
export async function getSBTCPlanExecutionHistory(
  planId: number,
  targetTokenContract: string,
  limit = 100
): Promise<SBTCPlanExecutionEvent[]> {
  const contractId = `${DCA_SBTC_CONTRACT_ADDRESS}.${DCA_SBTC_CONTRACT_NAME}`;
  const res = await fetch(
    `${HIRO_API}/extended/v1/address/${contractId}/transactions_with_transfers?limit=${limit}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`Failed to fetch sBTC history: ${res.status}`);
  const json = (await res.json()) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results?: any[];
  };

  const events: SBTCPlanExecutionEvent[] = [];
  for (const item of json.results ?? []) {
    const tx = item.tx ?? item;
    if (tx.tx_type !== "contract_call") continue;
    const cc = tx.contract_call;
    if (cc?.function_name !== "execute-dca") continue;
    const firstArg = cc.function_args?.[0];
    if (!firstArg || firstArg.repr !== `u${planId}`) continue;

    const status =
      tx.tx_status === "success" ? "success" :
      tx.tx_status === "pending" ? "pending" : "failed";
    const { sbtcIn, protocolFeeStx } = parseSBTCExecuteResult(tx.tx_result?.repr);

    let tokenOut: number | undefined;
    if (status === "success") {
      const transfers = (item.ft_transfers ?? []) as Array<{
        asset_identifier?: string;
        amount?: string;
      }>;
      for (const t of transfers) {
        if (
          t.asset_identifier &&
          t.asset_identifier.startsWith(targetTokenContract) &&
          t.amount
        ) {
          tokenOut = (tokenOut ?? 0) + Number(t.amount);
        }
      }
    }

    events.push({
      txId: tx.tx_id,
      blockHeight: Number(tx.block_height ?? 0),
      blockTime: Number(tx.burn_block_time ?? tx.block_time ?? 0),
      status,
      sbtcIn,
      protocolFeeStx,
      tokenOut,
      targetTokenContract,
    });
  }
  return events;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/dca-sbtc.ts
git commit -m "feat(dca-sbtc): add execute-dca event scanner + types"
```

---

### Task 2: Library — `getAllSBTCUserPlans` split

**Files:**
- Modify: `src/lib/dca-sbtc.ts`

- [ ] **Step 1: Add the helper**

Append after the existing `getSBTCUserPlans` function:

```ts
/**
 * Like getSBTCUserPlans, but split by `plan.active`. The on-chain uids list
 * never shrinks (cancel-plan does not remove from uids), so completed/cancelled
 * plans are still reachable here.
 */
export async function getAllSBTCUserPlans(
  address: string
): Promise<{ active: DCA_SBTCPlan[]; completed: DCA_SBTCPlan[] }> {
  const plans = await getSBTCUserPlans(address);
  const active: DCA_SBTCPlan[] = [];
  const completed: DCA_SBTCPlan[] = [];
  for (const p of plans) {
    if (p.active) active.push(p);
    else completed.push(p);
  }
  return { active, completed };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dca-sbtc.ts
git commit -m "feat(dca-sbtc): add getAllSBTCUserPlans active/completed split"
```

---

### Task 3: Library — aggregator (RED)

**Files:**
- Create: `src/lib/dca-sbtc.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/dca-sbtc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  aggregateSBTCPlanPerformance,
  type SBTCPlanExecutionEvent,
} from "./dca-sbtc";

const TGT = "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx";

function ev(
  partial: Partial<SBTCPlanExecutionEvent>
): SBTCPlanExecutionEvent {
  return {
    txId: "0xabc",
    blockHeight: 1,
    blockTime: 1_700_000_000,
    status: "success",
    sbtcIn: 100_000,    // 0.001 sBTC = 100k sats
    tokenOut: 50_000_000, // 50 USDCx (6 decimals)
    targetTokenContract: TGT,
    ...partial,
  };
}

describe("aggregateSBTCPlanPerformance", () => {
  it("returns zeros when no events", () => {
    const r = aggregateSBTCPlanPerformance(1, []);
    expect(r.executionCount).toBe(0);
    expect(r.totalSbtcIn).toBe(0);
    expect(r.totalTokenOut).toBe(0);
    expect(r.avgSbtcPerToken).toBe(0);
    expect(r.avgTokenPerSbtc).toBe(0);
    expect(r.firstExecutionAt).toBeNull();
    expect(r.lastExecutionAt).toBeNull();
    expect(r.targetTokenContract).toBeNull();
  });

  it("ignores non-success events from totals but counts them", () => {
    const events = [
      ev({ blockTime: 1_700_000_100 }),
      ev({ status: "pending", sbtcIn: undefined, tokenOut: undefined, blockTime: 0 }),
      ev({ status: "failed", sbtcIn: undefined, tokenOut: undefined, blockTime: 1_700_000_200 }),
    ];
    const r = aggregateSBTCPlanPerformance(7, events);
    expect(r.executionCount).toBe(3);
    expect(r.totalSbtcIn).toBe(100_000);
    expect(r.totalTokenOut).toBe(50_000_000);
    expect(r.successfulEvents).toHaveLength(1);
  });

  it("aggregates totals and averages across successful events", () => {
    const events = [
      ev({ sbtcIn: 100_000, tokenOut: 50_000_000, blockTime: 1_700_000_100 }),
      ev({ sbtcIn: 100_000, tokenOut: 60_000_000, blockTime: 1_700_000_200 }),
    ];
    const r = aggregateSBTCPlanPerformance(7, events);
    expect(r.totalSbtcIn).toBe(200_000);                  // sats
    expect(r.totalTokenOut).toBe(110);                    // 110 USDCx in base units (6 dp)
    expect(r.avgSbtcPerToken).toBeCloseTo(200_000 / 110); // sats per USDCx
    expect(r.avgTokenPerSbtc).toBeCloseTo(110 / 0.002);   // USDCx per 1 sBTC (0.002 = 200k sats)
    expect(r.firstExecutionAt).toBe(1_700_000_100);
    expect(r.lastExecutionAt).toBe(1_700_000_200);
    expect(r.targetTokenContract).toBe(TGT);
  });

  it("scales target-token units by decimals (default 6)", () => {
    const r = aggregateSBTCPlanPerformance(
      1,
      [ev({ tokenOut: 1_234_567_890 })]
    );
    expect(r.totalTokenOut).toBeCloseTo(1234.56789);
  });

  it("respects custom targetTokenDecimals override", () => {
    const r = aggregateSBTCPlanPerformance(
      1,
      [ev({ tokenOut: 1_234_567_890 })],
      8
    );
    expect(r.totalTokenOut).toBeCloseTo(12.3456789);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/lib/dca-sbtc.test.ts
```

Expected: FAIL — `aggregateSBTCPlanPerformance is not a function`.

- [ ] **Step 3: Commit RED**

```bash
git add src/lib/dca-sbtc.test.ts
git commit -m "test(dca-sbtc): RED tests for aggregateSBTCPlanPerformance"
```

---

### Task 4: Library — aggregator (GREEN)

**Files:**
- Modify: `src/lib/dca-sbtc.ts`

- [ ] **Step 1: Implement the aggregator**

Append after `getSBTCPlanExecutionHistory`:

```ts
export interface SBTCPlanPerformance {
  planId: number;
  executionCount: number;
  /** sats (unscaled). */
  totalSbtcIn: number;
  /** Target-token in base units (e.g. USDCx, scaled by targetTokenDecimals). */
  totalTokenOut: number;
  /** sats per 1 base-unit token. */
  avgSbtcPerToken: number;
  /** Base-unit tokens per 1 sBTC (1 sBTC = 1e8 sats). */
  avgTokenPerSbtc: number;
  firstExecutionAt: number | null;
  lastExecutionAt: number | null;
  successfulEvents: SBTCPlanExecutionEvent[];
  targetTokenContract: string | null;
  targetTokenDecimals: number;
}

/**
 * Aggregate execution events into per-plan performance numbers.
 * Pure — no I/O. `targetTokenDecimals` defaults to 6 (USDCx).
 */
export function aggregateSBTCPlanPerformance(
  planId: number,
  events: SBTCPlanExecutionEvent[],
  targetTokenDecimals = 6
): SBTCPlanPerformance {
  const successful = events.filter((e) => e.status === "success");
  const totalSbtcInSats = successful.reduce((s, e) => s + (e.sbtcIn ?? 0), 0);
  const totalTokenOutMicro = successful.reduce((s, e) => s + (e.tokenOut ?? 0), 0);
  const totalTokenOut = totalTokenOutMicro / Math.pow(10, targetTokenDecimals);
  const totalSbtc = totalSbtcInSats / 1e8;

  const avgSbtcPerToken = totalTokenOut > 0 ? totalSbtcInSats / totalTokenOut : 0;
  const avgTokenPerSbtc = totalSbtc > 0 ? totalTokenOut / totalSbtc : 0;

  const times = successful.map((e) => e.blockTime).filter((t) => t > 0);
  const firstExecutionAt = times.length ? Math.min(...times) : null;
  const lastExecutionAt = times.length ? Math.max(...times) : null;

  const targetTokenContract =
    successful.find((e) => e.targetTokenContract)?.targetTokenContract ??
    events.find((e) => e.targetTokenContract)?.targetTokenContract ??
    null;

  return {
    planId,
    executionCount: events.length,
    totalSbtcIn: totalSbtcInSats,
    totalTokenOut,
    avgSbtcPerToken,
    avgTokenPerSbtc,
    firstExecutionAt,
    lastExecutionAt,
    successfulEvents: successful,
    targetTokenContract,
    targetTokenDecimals,
  };
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test -- src/lib/dca-sbtc.test.ts
```

Expected: PASS — all 5 tests green.

- [ ] **Step 3: Commit GREEN**

```bash
git add src/lib/dca-sbtc.ts
git commit -m "feat(dca-sbtc): implement aggregateSBTCPlanPerformance"
```

---

### Task 5: UI — extract `DCAInPanel` (no behaviour change)

**Files:**
- Create: `src/components/dca/performance/DCAInPanel.tsx`
- Modify: `src/components/dca/performance/DCAPerformanceContent.tsx`

- [ ] **Step 1: Create DCAInPanel.tsx**

Create the new file by moving the body of `DCAPerformanceContent.tsx`'s default export, replacing the outer `<div className="flex flex-col min-h-screen">` + `<Topbar>` + `<AnimatedPage>` wrapper with a single `<StaggerChildren>` (the wrapper stays in `DCAPerformanceContent` so it's shared with the Out tab).

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
      const results: PlanWithPerf[] = [];
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
      await Promise.all(uniqueDates.map(async (d) => {
        const prices = await getHistoricalStxBtcPrices(d);
        priceByDate.set(d, prices);
      }));
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
            icon={<Wallet size={28} style={{ color: "var(--accent)" }} />}
            title="Connect your wallet to view performance"
            description="Connect to see cost basis and execution history for all your DCA plans."
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
            No executions yet
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Your plans haven&apos;t been executed by the keeper bot yet. Performance metrics will appear once the first swap completes.
          </p>
        </div>
      </MotionCard>
    );
  }
  if (!totals) return null;

  return (
    <>
      {/* swap-analyzed badge — was in the header row; move here so tabs UI owns the header */}
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
          <SummaryCard icon={<Coins size={13} />} label="STX invested"
            primary={`${formatStx(totals.stxIn)} STX`}
            secondary={stx ? `${formatUSD(totals.stxIn * stx.price)} at spot` : '—'}
            accent="#00C27A" />
          <SummaryCard icon={<Bitcoin size={13} />} label="sBTC accumulated"
            primary={`${formatSbtc(totals.sbtcOut)} sBTC`}
            secondary={btcUsd ? `${formatUSD(totals.sbtcOut * btcUsd)} at spot` : '—'}
            accent="#F7931A" />
          <SummaryCard icon={<BarChart3 size={13} />} label="Avg cost basis"
            primary={`${formatStx(totals.avgStxPerSbtc, 1)} STX`}
            secondary="per 1 sBTC" accent="#A78BFA" />
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
                <p className="text-2xl font-bold font-data"
                  style={{ color: basisVsSpotPct >= 0 ? '#00C27A' : '#F04A6E', letterSpacing: '-0.02em' }}>
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
                <p className="text-2xl font-bold font-data"
                  style={{ color: lumpSumAggregate.deltaPct >= 0 ? '#00C27A' : '#F04A6E', letterSpacing: '-0.02em' }}>
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
          <div className="glass-card rounded-2xl p-5" style={{ ['--card-accent' as string]: 'var(--text-muted)' }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <BarChart3 size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Lump-sum comparison unavailable</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Historical STX/BTC prices for your plan start dates couldn&apos;t be fetched from CoinGecko. The basis-vs-today&apos;s-spot strip above still works.
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
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Per-plan breakdown</h2>
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
  const planStxValueUsd = stxUsd ? perf.totalStxIn * stxUsd : null;
  const planSbtcValueUsd = btcUsd ? perf.totalSbtcOut * btcUsd : null;
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
        <Cell label="STX in" value={`${formatStx(perf.totalStxIn)}`}
          sub={planStxValueUsd !== null ? formatUSD(planStxValueUsd) : undefined} />
        <Cell label="sBTC out" value={formatSbtc(perf.totalSbtcOut)} sub={`${formatSats(perf.totalSbtcOut)} sats`} />
        <Cell label="Avg cost" value={`${formatStx(perf.avgStxPerSbtc, 0)} STX/sBTC`}
          sub={planSbtcValueUsd !== null ? `≈ ${formatUSD(planSbtcValueUsd)} now` : undefined} />
      </div>

      {lumpSum && (
        <div className="mt-3 pt-3 flex items-center justify-between flex-wrap gap-2"
          style={{ borderTop: '1px dashed var(--border-subtle)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="font-semibold uppercase tracking-wider" style={{ letterSpacing: '0.08em' }}>vs lump sum</span>
            {' '}on {formatDate(new Date(lumpSum.referenceDate + 'T00:00:00Z').getTime() / 1000)} —
            lump would&apos;ve been <span className="font-data" style={{ color: 'var(--text-secondary)' }}>{formatSbtc(lumpSum.lumpSumSbtc)}</span> sBTC
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
```

- [ ] **Step 2: Slim `DCAPerformanceContent.tsx` down to render InPanel only (still no behaviour change)**

Replace the entire file content with:

```tsx
"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import { useWalletStore } from "@/store/walletStore";
import DCAInPanel from "./DCAInPanel";

export default function DCAPerformanceContent() {
  const { isConnected, stxAddress } = useWalletStore();

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="DCA Performance" />
      <AnimatedPage className="max-w-5xl mx-auto w-full px-4 py-6">
        <StaggerChildren className="flex flex-col gap-6">
          <MotionCard disableHover>
            <Link href="/dca"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft size={14} />
              Back to plans
            </Link>
          </MotionCard>
          <DCAInPanel isConnected={isConnected} stxAddress={stxAddress} />
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
```

- [ ] **Step 3: Verify build + visual parity**

```bash
npm run lint && npm run build
```

Expected: clean. Then `npm run dev` and open http://localhost:3000/dca/performance — UI should match pre-change (modulo the "N swaps analyzed" badge now living above the cards instead of in the back-link row; that's the only intentional diff).

- [ ] **Step 4: Commit**

```bash
git add src/components/dca/performance/DCAInPanel.tsx src/components/dca/performance/DCAPerformanceContent.tsx
git commit -m "refactor(dca/performance): extract DCAInPanel from Content"
```

---

### Task 6: UI — `PerformanceTabs` component

**Files:**
- Create: `src/components/dca/performance/PerformanceTabs.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

type Tab = "in" | "out";

export default function PerformanceTabs({
  active, onChange,
}: { active: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; label: string }[] = [
    { id: "in", label: "DCA In" },
    { id: "out", label: "DCA Out" },
  ];
  return (
    <div
      className="flex items-center gap-1 border-b"
      style={{ borderColor: "var(--border-subtle)" }}
      role="tablist"
      aria-label="DCA performance view"
    >
      {items.map((it) => {
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(it.id)}
            className="px-4 py-2 text-sm font-semibold transition-colors relative"
            style={{
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {it.label}
            {isActive && (
              <span
                className="absolute left-0 right-0 -bottom-px h-0.5"
                style={{ backgroundColor: "var(--accent)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dca/performance/PerformanceTabs.tsx
git commit -m "feat(dca/performance): add PerformanceTabs nav component"
```

---

### Task 7: UI — `DCAOutPanel`

**Files:**
- Create: `src/components/dca/performance/DCAOutPanel.tsx`

- [ ] **Step 1: Create the panel**

```tsx
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
          const events = await getSBTCPlanExecutionHistory(plan.id, plan.token, 100);
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
        <Link href={`https://explorer.hiro.so/txid/${perf.successfulEvents[perf.successfulEvents.length - 1].txId}?chain=mainnet`}
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
```

- [ ] **Step 2: Verify build**

```bash
npm run lint && npm run build
```

Expected: clean. The new file is not yet imported anywhere, so no visual change yet.

- [ ] **Step 3: Commit**

```bash
git add src/components/dca/performance/DCAOutPanel.tsx
git commit -m "feat(dca/performance): add DCAOutPanel for sBTC->USDCx vault"
```

---

### Task 8: Wire tabs into the page

**Files:**
- Modify: `src/components/dca/performance/DCAPerformanceContent.tsx`

- [ ] **Step 1: Replace file content**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import { useWalletStore } from "@/store/walletStore";
import DCAInPanel from "./DCAInPanel";
import DCAOutPanel from "./DCAOutPanel";
import PerformanceTabs from "./PerformanceTabs";

export default function DCAPerformanceContent() {
  const { isConnected, stxAddress } = useWalletStore();
  const [tab, setTab] = useState<"in" | "out">("in");

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="DCA Performance" />
      <AnimatedPage className="max-w-5xl mx-auto w-full px-4 py-6">
        <StaggerChildren className="flex flex-col gap-6">
          <MotionCard disableHover>
            <Link href="/dca"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft size={14} />
              Back to plans
            </Link>
          </MotionCard>

          <MotionCard disableHover>
            <PerformanceTabs active={tab} onChange={setTab} />
          </MotionCard>

          {tab === "in"
            ? <DCAInPanel isConnected={isConnected} stxAddress={stxAddress} />
            : <DCAOutPanel isConnected={isConnected} stxAddress={stxAddress} />}
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Open http://localhost:3000/dca/performance:
- Default lands on "DCA In" tab → existing UI renders, no network calls to sBTC contract.
- Click "DCA Out" → Out fetch fires (check Network tab for one request to `…dca-vault-sbtc-v2/transactions_with_transfers`). If user has 0 Out plans → empty state with "Create a DCA Out plan →" CTA. If 0 executions → "No executions yet" state. If executions exist → summary cards + spot strip + per-plan breakdown.
- Switch back to "DCA In" → state preserved, no refetch (SWR cache).

- [ ] **Step 3: Build + lint**

```bash
npm run lint && npm run build && npm test -- src/lib/dca-sbtc.test.ts
```

Expected: all clean and green.

- [ ] **Step 4: Free port 3000**

```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add src/components/dca/performance/DCAPerformanceContent.tsx
git commit -m "feat(dca/performance): tab-split In/Out panels"
```

---

### Task 9: Update memory backlog

**Files:**
- Modify: `/Users/vanhuy/.claude/projects/-Users-vanhuy-Desktop-StacksPort/memory/project_dca_polish_backlog.md`

- [ ] **Step 1: Mark item #11 as SHIPPED**

Find the section starting with `### 11. /dca/performance only covers DCA In` and prepend `— SHIPPED 2026-05-23 (<commit hash from Task 8 step 5>)` to the heading. Add a brief note: "Tab-split via DCAInPanel/DCAOutPanel; Out uses spot-strip framing (no lump-sum/no chart) because USDCx is stable."

Per memory rule: do NOT git-add or commit this file. It is a local-only memory file.

---

## Self-Review

**Spec coverage:**
- Tab layout + lazy fetch → Tasks 5–8.
- Library helpers (`getSBTCPlanExecutionHistory`, `aggregateSBTCPlanPerformance`, `getAllSBTCUserPlans`) → Tasks 1, 2, 4.
- DCA Out panel content (4 summary cards, spot strip, per-plan rows, no lump-sum, no chart) → Task 7.
- Empty/loading/zero-execution states → Task 7.
- Risk: tx_result.repr format verification → Task 1 Step 1.

**Placeholder scan:** none. Every code block is complete.

**Type consistency:** `SBTCPlanExecutionEvent` (Task 1) → consumed by `aggregateSBTCPlanPerformance` (Task 4) → `SBTCPlanPerformance` consumed by `DCAOutPanel` (Task 7). `targetTokenContract` field name consistent. `targetTokenDecimals` parameter present in both interface and function signature.

---

## Execution Handoff
