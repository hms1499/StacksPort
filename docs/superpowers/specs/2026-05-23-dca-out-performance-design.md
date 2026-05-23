# DCA Out coverage on `/dca/performance`

**Status:** approved — ready for implementation plan
**Date:** 2026-05-23
**Backlog item:** `dca-polish-backlog#11`

## Goal

Extend `/dca/performance` (currently STX→sBTC only) to also cover the DCA Out vault (sBTC→USDCx) via a tab-based split. The In view's UI is preserved byte-identical and moved behind a "DCA In" tab; a new "DCA Out" tab is added next to it.

## Non-goals

- No lump-sum counterfactual for Out (USDCx is a stable; the framing adds confusion rather than insight — see brainstorm decision).
- No 90-day cost-basis chart for Out (defer until users ask).
- No new contracts, no contract changes.
- No multi-target-token grouping work beyond what USDCx alone requires; aggregator is target-agnostic but UI is single-target for v1.

## Architecture

### Tab layout

`DCAPerformanceContent.tsx` becomes a thin wrapper holding `activeTab: "in" | "out"` React state (no URL param — keeps URL clean, back/forward not affected). The page header + back link stay shared; below them sits `PerformanceTabs` then either `<DCAInPanel/>` or `<DCAOutPanel/>`.

Data fetching is **lazy per tab**: the Out panel only mounts (and thus fires its SWR + history fetches) when the user selects the Out tab. This keeps Hiro budget tight — most users will not view both tabs in a single session.

### File layout

```
src/components/dca/performance/
├── DCAPerformanceContent.tsx   thin wrapper, tabs + activeTab state
├── DCAInPanel.tsx              extracted from current Content (no behaviour change)
├── DCAOutPanel.tsx             new
├── PerformanceTabs.tsx         new — 2-button underline tab nav
└── CostBasisChart.tsx          unchanged, only rendered inside InPanel
```

### Library additions (`src/lib/dca-sbtc.ts`)

Mirror the In side's helpers, scoped to the `dca-vault-sbtc-v2` contract:

```ts
export interface SBTCPlanExecutionEvent {
  txId: string;
  blockHeight: number;
  blockTime: number; // unix seconds; 0 if pending
  status: "success" | "pending" | "failed";
  sbtcIn?: number;          // sats actually swapped (from tx_result net-swapped)
  protocolFeeStx?: number;  // micro-STX fee (gas — same shape as In side)
  tokenOut?: number;        // target-token micro-units credited via ft_transfer
  targetTokenContract?: string; // asset id without ::name suffix
}

export async function getSBTCPlanExecutionHistory(
  planId: number,
  limit?: number
): Promise<SBTCPlanExecutionEvent[]>;

export interface SBTCPlanPerformance {
  planId: number;
  executionCount: number;
  totalSbtcIn: number;          // sats
  totalTokenOut: number;        // target-token base units (NOT micro)
  avgSbtcPerToken: number;      // sats per 1 token
  avgTokenPerSbtc: number;      // tokens per 1 sBTC
  firstExecutionAt: number | null;
  lastExecutionAt: number | null;
  successfulEvents: SBTCPlanExecutionEvent[];
  targetTokenContract: string | null;
  targetTokenDecimals: number;
}

export function aggregateSBTCPlanPerformance(
  planId: number,
  events: SBTCPlanExecutionEvent[],
  targetTokenDecimals?: number // default 6 (USDCx)
): SBTCPlanPerformance;

export async function getAllSBTCUserPlans(
  address: string
): Promise<{ active: DCA_SBTCPlan[]; completed: DCA_SBTCPlan[] }>;
```

Notes:
- `getAllSBTCUserPlans` splits `getSBTCUserPlans(address)` by `plan.active`. The uids list never shrinks (per system-design-roadmap memo #5), so completed plans are still discoverable via the uids list.
- Event scan filters on `function_name === "execute-dca"` and first arg `u${planId}`, identical pattern to the In-side `getPlanExecutionHistory`.
- `tx_result.repr` parser regex: `net-swapped u(\d+)` and `protocol-fee u(\d+)` (same shape as In contract — verify against an actual mainnet exec tx before shipping).
- `tokenOut` is read from `ft_transfers` whose `asset_identifier` starts with `plan.token` (the target contract). For USDCx this matches `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx::usdcx` (asset name verified before commit).

### DCA Out panel content

**Summary cards (4):**

| Card | Primary | Secondary |
|---|---|---|
| Swaps executed | `N` | across `M` plans |
| sBTC invested | `0.0145 sBTC` | `$1,234 at spot` (sBTC × btcUsd) |
| USDCx received | `1,250 USDCx` | `$1,250` (USDCx ≈ $1) |
| Avg sell rate | `86,200 USDCx/sBTC` | per 1 sBTC |

**Spot strip:** "Your avg sell rate vs today's spot"
- User avg = `totalTokenOut / totalSbtcIn` (USDCx per sBTC)
- Spot = `btcUsd` (USDCx ≈ $1, so 1 sBTC ≈ btcUsd USDCx)
- `deltaPct = (userAvg − spot) / spot × 100`
- `>0` → green "sold above spot"
- `<0` → red "sold below spot"
- Tooltip: "Weighted-avg USDCx received per sBTC across executions vs current sBTC→USDCx rate. Positive % means you sold at better-than-current rates."

**Per-plan breakdown:** mirror In's `PlanRow` structure. Cells: Executions / sBTC in / USDCx out / Avg rate. No lump-sum row.

**Empty / loading / no-Out-plans states:** parallel to In's pattern — `EmptyState` for no wallet, skeleton during fetch, "No DCA Out plans yet" with CTA to `/dca?direction=out`, "No executions yet" zero state.

### Data flow (Out tab)

```
user clicks "DCA Out" tab
  → DCAOutPanel mounts
    → useSWR(["sbtc-all-plans", stxAddress], getAllSBTCUserPlans, dedupe 30s)
    → useEffect: for each plan, sequentially fetch getSBTCPlanExecutionHistory(plan.id, 100)
                  → aggregateSBTCPlanPerformance(plan.id, events, 6)
                  → setPerPlan(results)
    → useSTXMarketStats() + getBtcUsdPrice() (already in tree via shared hooks)
    → render
```

## Implementation phases

**Phase A — Library extensions** (`dca-sbtc.ts`)
1. `SBTCPlanExecutionEvent` interface + `getSBTCPlanExecutionHistory`.
2. `SBTCPlanPerformance` interface + `aggregateSBTCPlanPerformance`.
3. `getAllSBTCUserPlans`.

**Phase B — UI extraction (no behaviour change)**
4. Extract current `DCAPerformanceContent.tsx` body (lines 274–492) into `DCAInPanel.tsx`. Props: `{ isConnected, stxAddress }`. Visual diff = none.
5. New `PerformanceTabs.tsx` — 2-button underline tab nav matching existing tab patterns in the repo.

**Phase C — DCA Out panel**
6. New `DCAOutPanel.tsx` implementing the data flow + cards above.
7. Wire tabs into `DCAPerformanceContent.tsx` with `activeTab` state.

**Phase D — Verify**
8. `npm run lint` + `npm run build` clean.
9. Manual smoke: load `/dca/performance` → default In tab UI matches pre-change → click Out tab → Out fetch fires once → panel renders → edge cases (no Out plans, no executions, pending tx).

## Edge cases

- **0 Out plans:** empty state with CTA `/dca?direction=out`.
- **Plans but 0 executions:** "No executions yet" zero state mirroring In's pattern.
- **Pending tx (`status === "pending"`):** excluded from totals; surfaced in per-plan row count only if we extend HistoryTab later (not in v1).
- **Failed tx (`status === "failed"`):** counted in `executionCount` but excluded from `totalSbtcIn` / `totalTokenOut` aggregates (same convention as In side).
- **Multiple target tokens for one user (future-proof):** aggregator dedupes per-plan by `targetTokenContract`. For v1 only USDCx exists so trivial; if a second target token is ever added (e.g. aeUSDC), summary cards will need a grouped view — flagged as a follow-up, out of scope here.

## Risks

- **Hiro rate limit:** fetch only fires when user actively switches to Out tab; sequential per-plan with the existing pattern that has held up at ~10 plans/user on the In side.
- **`tx_result.repr` format drift:** the regex parser assumes the same `(ok (tuple ...))` shape as the In contract. Verify against a real mainnet exec tx before shipping Phase A.
- **`ft_transfers` semantics:** USDCx may not appear if the keeper bot uses a different routing path. Verify against a real exec tx; if the transfer is recorded under a different asset_id, adjust the filter.

## Out of scope (deferred items)

- Per-execution lump-sum (`dca-polish-backlog#9`) — still pending separately.
- 90-day chart for Out — defer.
- HistoryTab parity for Out — separate effort if requested.
