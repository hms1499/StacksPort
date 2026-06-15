# DCA Backtest — Pre-Connect Activation Hook

**Date:** 2026-06-15
**Status:** Approved design (prototype)
**Topic:** A pre-connect backtest widget on the disconnected dashboard that shows what a real STX→sBTC DCA plan would have produced over the last 12 months.

## Problem

The disconnected `/dashboard` is the surface a not-yet-connected visitor lands on, and today it is mostly empty space below the connect banner (observed directly while verifying `/ja/dashboard`). The single highest-leverage thing we can show a skeptic is a *real* number from the product's own historical engine: "if you had DCA'd over the last year, you'd hold X sBTC — Y% better than a lump-sum buy." This turns the empty acquisition surface into an activation hook grounded in real data, not marketing copy.

## Goals

- Fill the disconnected-dashboard gap with a persuasive, **real** backtest result.
- Reuse the existing historical-price + lump-sum infrastructure; add only a thin simulation layer.
- Zero new per-user runtime cost (shared, cached server computation).
- Never fabricate numbers; fail invisibly if data is unavailable.

## Non-Goals (YAGNI)

- No interactive controls (amount/interval/period are fixed). Decided: fixed showcase.
- No landing-page placement in this iteration (dashboard-disconnected only).
- No per-token generality — STX→sBTC only.
- No new chart; a single headline result block (a sparkline may be added later, not required for the prototype).

## Decisions (from brainstorming)

1. **Mechanic:** fixed showcase (one scenario, precomputed server-side). Not interactive.
2. **Data freshness:** server-computed over a rolling 365-day window, cached (`revalidate 3600`). Numbers stay current without going stale-on-deploy.
3. **Placement:** disconnected dashboard only, directly below the connect banner.
4. **Connection gate:** client-side via `walletStore` — the widget renders `null` when a wallet is connected.

## Fixed Scenario

- **50 STX per week, over the last 12 months** (≈52 buys), STX → sBTC.
- These constants live in one place in `src/lib/server/backtest-snapshot.ts` so changing the showcase is a one-line edit.

## Architecture — four isolated units

### 1. `src/lib/backtest.ts` — pure simulation (no I/O)

```ts
export interface BacktestParams {
  amountStx: number;     // per-interval STX spend (default 50)
  intervalDays: number;  // cadence in days (default 7)
  lookbackDays: number;  // window length (default 365)
}

export interface BacktestResult {
  totalStxIn: number;        // STX spent across all simulated buys
  totalSbtcOut: number;      // sBTC accumulated
  swaps: number;             // number of simulated buys
  startDate: string;         // YYYY-MM-DD of first buy
  currentBtcUsd: number;     // BTC/USD at the latest series point
  currentValueUsd: number;   // totalSbtcOut * currentBtcUsd
  vsLump: LumpSumScenario | null; // from computeLumpSum (dca.ts)
}

export function simulateBacktest(
  params: BacktestParams,
  priceSeries: Map<string, { stxUsd: number; btcUsd: number }>, // YYYY-MM-DD → prices
): BacktestResult | null;
```

Logic:
- Iterate from the oldest date in the window forward in `intervalDays` steps. For each buy date, look up its price point (or the nearest earlier available point if that exact day is missing); buy `sBTC = (amountStx * stxUsd) / btcUsd`; accumulate `totalSbtcOut` and `totalStxIn += amountStx`.
- Use the first buy's date + its `{stxUsd, btcUsd}` as the lump-sum reference; compute `vsLump` via the existing `computeLumpSum({ totalStxIn, totalSbtcOut }, startDate, stxUsdAtStart, btcUsdAtStart)`.
- `currentBtcUsd` = the latest available point's `btcUsd`; `currentValueUsd = totalSbtcOut * currentBtcUsd`.
- Return `null` if fewer than 2 usable price points or `totalStxIn <= 0` (cannot make a meaningful claim).

Pure and deterministic → unit-testable without network.

### 2. `src/lib/server/backtest-snapshot.ts` — server-only aggregator

- Follows the existing `src/lib/server/*-snapshot.ts` pattern (route/server-module only consumers).
- `getBacktestSnapshot(): Promise<BacktestResult | null>`:
  - `const series = await getHistoricalStxBtcRange(365)` (existing fn in `stacks.ts`; 2 HTTP calls).
  - `return simulateBacktest(SHOWCASE_PARAMS, series)`.
- Wrapped so the work is shared/cached. Cadence: `revalidate 3600` (a 12-month result barely moves hour-to-hour). On any fetch failure `getHistoricalStxBtcRange` already returns an empty/partial map → `simulateBacktest` returns `null` → snapshot is `null`.

### 3. `src/app/[locale]/dashboard/page.tsx` — wiring

- Already a server component with `revalidate = 60` and `await getMarketSnapshot()`.
- Add `const backtest = await getBacktestSnapshot();` and render `<DcaBacktestHero backtest={backtest} />` directly in the page, above the grid. `DashboardGridClient` stays unchanged (no prop threading through `SWRConfig`). The prop is a small serializable DTO — no client fetch.

### 4. `src/components/dashboard/DcaBacktestHero.tsx` — client widget

- `"use client"`. Reads wallet connection from `walletStore`.
- **Renders `null` when a wallet is connected** (only shown to disconnected visitors) **and when the `backtest` prop is `null`** (data unavailable).
- Otherwise renders the headline block: accumulated sBTC, current USD value, and the **vs-lump-sum %** (`vsLump.deltaPct`), with a CTA "Start your plan" that triggers the existing wallet-connect flow.
- Placed directly under the connect banner in the disconnected dashboard layout.

## Data Flow

```
dashboard/page.tsx (server, cached)
  └─ getBacktestSnapshot()              [src/lib/server/backtest-snapshot.ts, revalidate 3600]
       └─ getHistoricalStxBtcRange(365) [src/lib/stacks.ts, 2 CoinGecko calls]
       └─ simulateBacktest(params, series) [src/lib/backtest.ts, pure]
            └─ computeLumpSum(...)       [src/lib/dca.ts, pure]
  ├─ <DcaBacktestHero backtest={...}/>  (client sibling; null if connected OR backtest null)
  └─ <DashboardGridClient/>             (unchanged)
```

## Error Handling

- **Data unavailable** (CoinGecko down / rate-limited / partial): snapshot is `null` → widget renders nothing. The disconnected dashboard looks exactly as it does today. No broken widget, no fabricated figures.
- **Connected wallet:** widget renders nothing (real portfolio takes over).
- The widget must never block or delay the rest of the dashboard render.

## Testing

- **Unit (`src/lib/backtest.test.ts`):** feed `simulateBacktest` a small synthetic deterministic price series; assert `swaps`, `totalStxIn`, `totalSbtcOut`, and `vsLump.deltaPct`. Include a `null` case (empty/one-point series).
- **i18n parity:** all new UI strings added under a new namespace section (e.g. `dashboard.backtest.*`) to **en, vi, zh, ja**; the existing `src/i18n/messages.test.ts` parity test enforces key-for-key coverage.
- **E2E (optional, light):** not required for the prototype; the mock-wallet fixture defaults complicate asserting the disconnected state. Defer.

## i18n Keys (new — all four catalogs)

Under `dashboard.backtest`:
- `eyebrow` — e.g. "If you had been stacking…"
- `headline` — uses `{stx}`/`{interval}` to state the scenario ("50 STX every week for 12 months")
- `sbtcLabel`, `valueLabel`, `vsLumpLabel`
- `cta` — "Start your plan"
- `disclaimer` — "Based on real STX/BTC prices over the last 12 months. Past performance is not indicative of future results."

(Exact copy finalized during implementation; numbers are interpolated, kept out of the translated strings per the existing `String(...)`/ICU rule to avoid thousands-grouping.)

## Out of Scope / Follow-ups

- Landing-page placement reusing the same widget.
- Interactive presets (10/week, 100/month…) as a later enhancement.
- A sparkline of accumulated value over time.
- Telemetry on widget impression → connect conversion (ties into the broader "instrument the activation funnel" recommendation).
