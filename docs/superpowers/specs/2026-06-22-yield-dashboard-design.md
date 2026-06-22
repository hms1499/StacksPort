# Live Yield Dashboard (`/earn`) — Design

**Date:** 2026-06-22
**Status:** Approved (design), pending implementation plan
**Approach:** B — Hybrid live APY (StackingDAO + Zest live; PoX stacking stays estimated)

## Goal & Scope

Turn `/earn` from a static APY menu into a live yield dashboard:

1. **Aggregate active positions** — surface the user's live yield positions across
   StackingDAO / Lisa / Arkadiko / Zest in one place, plus a total earning value and
   an estimated annual yield.
2. **Live APY** — show live APY instead of hardcoded estimates: the StackingDAO liquid
   stacking APY drives the stacking row in `YieldOpportunities`, and live Zest supply
   APY is shown next to the user's Zest positions in `YieldPositions`.

PoX solo/pooled stacking APY stays a labeled "estimated" value; computing it from
burnchain rewards is deferred to a separate follow-up task (Approach A upgrade).

**Hard constraint:** zero new on-chain contracts. Everything is read-only data
aggregation plus the existing `stakeStx` execution path. No deploy, no extra gas.

### Out of scope
- New execution paths (e.g. in-app Zest supply, Lisa stake). Execution stays as the
  existing StackingDAO `stakeStx` modal.
- PoX stacking APY computation from burnchain rewards (deferred follow-up).
- Auto-compound / rebalance automation (would need a custom contract — explicitly later).

## Why these data sources (verified 2026-06-22)

- **DefiLlama Yields API** (`https://yields.llama.fi/pools`): live call returned only
  **6 Stacks pools, all `project=zest-v2`** (sBTC, USDC, USDH, stSTX, STX, stSTX-BTC),
  each with a clean `apyBase`. No StackingDAO / Lisa / Arkadiko / PoX coverage. So
  DefiLlama is used **only for Zest lending APY**.
- **StackingDAO** (`https://app.stackingdao.com/api/apy`): returns a single number
  (e.g. `3.92`) = liquid stacking APY. Used directly.
- **PoX stacking APY**: NOT directly available from `/v2/pox` (no BTC rewards per
  cycle). Computable from `/extended/v1/burnchain/rewards` + `/extended/v2/pox/cycles`
  but that aggregation is fragile/expensive — deferred. Keep estimate for now.

## Architecture & data flow

Two independent flows, matching the existing snapshot conventions:

### APY (shared, not per-wallet)
New endpoint `GET /api/yield/snapshot`, Vercel Runtime Cache, TTL 600s, tag `yield`
(clones the `market-snapshot` route pattern exactly). Aggregator fans out in parallel,
each source wrapped in `safe()` so one failure degrades a field rather than the response:

- StackingDAO `/api/apy` → liquid stacking APY
- DefiLlama `/pools` filtered to `chain=Stacks && project=zest-v2`, mapped by symbol

### Positions (per-wallet)
**Reuse the existing `useProtocolPositions` hook** (`src/hooks/useMarketData.ts:319`),
which already calls `fetchAllPositions` (`src/lib/protocol-positions.ts`) for
StackingDAO / Lisa / Arkadiko / Zest. This hook already powers the `/apps` page.
Do NOT add positions to `portfolio-snapshot` — reusing the client hook avoids
duplication and keeps the protocol-list dependency client-side where it already lives.

## Files

### New
- `src/lib/server/defillama-yields.ts` — fetch + parse DefiLlama pools, filter to
  Stacks/Zest, return `{ symbol, apy }[]`.
- `src/lib/server/stackingdao-apy.ts` — fetch `/api/apy`, return `number | null`.
- `src/lib/server/yield-snapshot.ts` — `getYieldSnapshot()` aggregator (mirrors
  `market-snapshot.ts`, including the `safe()` helper and `E2E` short-circuit if needed).
- `src/app/api/yield/snapshot/route.ts` — route handler + cache (clone of
  `src/app/api/market/snapshot/route.ts`, key `yield-snapshot:v1`, tag `yield`).
- `src/hooks/useYieldSnapshot.ts` — SWR hook + selectors (`useStackingApy`,
  `useZestApy(symbol)`).
- `src/components/earn/YieldPositions.tsx` — "Your positions" section built from
  `useProtocolPositions`. For Zest supplied positions, show the live supply APY from
  `useYieldSnapshot` (matched by symbol) next to the position; other protocols show the
  position value only.
- `src/components/earn/YieldSummaryHero.tsx` — total earning value + estimated annual
  yield (blends position USD totals with live APY where available).

### Changed
- `src/components/earn/YieldOpportunities.tsx` — the **stacking row** reads live
  StackingDAO APY from `useYieldSnapshot`, falling back to the existing hardcoded
  estimate (with the current "estimated" label) when null. The **sBTC and DCA rows are
  left unchanged** — they represent accumulation strategies (link to `/trade` / `/dca`),
  not a lending APY, so forcing Zest's supply APY there would mix concepts. Zest live APY
  is surfaced in `YieldPositions` instead (see below).
- `src/components/earn/EarnPageContent.tsx` — mount `YieldSummaryHero` and
  `YieldPositions`.

## Data shape

```ts
interface YieldSnapshot {
  generatedAt: number;
  stackingApy: number | null;     // StackingDAO liquid stacking, percent
  zest: Record<string, number>;   // symbol -> apy percent, e.g. { SBTC: 0.01, USDC: 0.32 }
  sources: {
    stackingDao: "ok" | "unavailable";
    zest: "ok" | "unavailable";
  };
}
```

`zest` symbols are uppercased to match the keys the UI looks up (`SBTC`, `USDC`,
`STSTX`, `STX`, …).

## Error handling (fail-invisible)

Follows the established backtest/snapshot pattern:

- Each APY source wrapped in `safe()` → `null` on error. The UI shows the existing
  hardcoded estimate plus the "estimated" label; the page never breaks.
- `sources` flags (`ok` / `unavailable`) carried for debugging/observability.
- Positions: `fetchAllPositions` already uses `Promise.allSettled` per protocol, so one
  protocol failing leaves the others intact.
- External APIs (DefiLlama, StackingDAO) are out of our control: 8s timeout each, and the
  600s cache masks brief downtime.

## Testing

- `defillama-yields.test.ts` — parse a fixture pools payload, assert only Zest pools are
  kept, symbols mapped/uppercased correctly, unrelated pools dropped.
- `stackingdao-apy.test.ts` — parse the numeric body; `null` on non-numeric/error.
- `yield-snapshot.test.ts` — aggregation + `sources` flag matrix (ok/unavailable
  combinations).
- Characterization: `YieldOpportunities` still renders the hardcoded estimate when the
  snapshot is null (proves no regression of existing behavior).
- E2E (light): `/earn` loads with a positions section and APY values present; use the
  server-side E2E fixture pattern if the snapshot needs to be deterministic.
- Gate: `npm test` (unit) + `npm run build` green before each commit.

## Task breakdown (small, independently-green commits)

Each is one green commit, RED→GREEN where a test exists, helper and wiring split:

1. `defillama-yields.ts` + test (pure client, not yet wired).
2. `stackingdao-apy.ts` + test.
3. `yield-snapshot.ts` aggregator + test.
4. `/api/yield/snapshot` route + cache.
5. `useYieldSnapshot.ts` hook + selectors.
6. `YieldOpportunities` reads live APY (+ characterization fallback test).
7. `YieldPositions.tsx` section + wire into `EarnPageContent`.
8. `YieldSummaryHero.tsx` + wire into `EarnPageContent`.
9. i18n keys (EN first, then locale parity for the existing 7 locales) + final
   `npm test` / `npm run build` verification.

## Follow-up (not in this scope)

- **PoX stacking APY (live)** — compute from `/extended/v1/burnchain/rewards` +
  `/extended/v2/pox/cycles` and feed it into the snapshot. Upgrades the design from
  Approach B to Approach A. One additive task; does not block anything here.
