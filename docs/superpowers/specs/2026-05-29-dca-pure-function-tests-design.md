# DCA pure-function characterization tests — design

**Date:** 2026-05-29
**Status:** Approved (brainstorming) — pending implementation plan

## Problem

`src/lib/dca.ts` (711 lines) has **zero** unit tests. `src/lib/dca-sbtc.ts`
(563 lines) has a single test file covering only `aggregateSBTCPlanPerformance`
(5 tests). These modules are the DCA money-path: cost-basis math, unit
conversions, and the lump-sum counterfactual surface real numbers to users.
The pure (deterministic, side-effect-free) functions there are cheap to cover
and high value — a regression in `tokenToMicro` or `aggregatePlanPerformance`
silently corrupts displayed balances and PnL.

This round covers **only the pure functions**. Contract-call builders
(`createPlan`, `executePlan`, …) and on-chain readers are explicitly out of
scope — they need a chain-mocking design and will be a separate effort.

## Decisions (from brainstorming)

1. **Philosophy: characterization, flag bugs separately.** Lock current
   behavior as the baseline (house style, matching `direct-swap.test.ts`).
   Expected values are hand-derived inline so the tests also document intended
   semantics. When a function's actual behavior looks like a money-path bug,
   record it in a watchlist and report at the end — **do not change production
   logic in this round.**
2. **Approach: colocated test files, hand-derived expected values.** No
   snapshots (opaque, hides NaN), no property-based testing (new dependency,
   overkill here).
3. **Include `batchedMap`** (async batching utility used for chain reads).

## Scope — 12 functions

### `src/lib/dca.test.ts` (new)

| Function | Test cases |
|---|---|
| `blocksToInterval` | All 12 known mappings → exact label (Daily/Weekly/Monthly × current / v2 / legacy / v1); unknown value (e.g. 999) → `"999 blocks"`; `0` → `"0 blocks"` |
| `microToToken` | default decimals 6 (1_500_000 → 1.5); decimals 8 (150_000_000 → 1.5); 0 → 0; 1 micro @ 6dp → 0.000001 |
| `tokenToMicro` | 1.5 → 1_500_000; decimals 8 (1.5 → 150_000_000); floor drops dust (0.0000005 → 0) — characterized; round-trips with `microToToken` |
| `microToSTX` / `stxToMicro` | aliases delegate at decimals 6; round-trip 2_000_000 ↔ 2 |
| `utcIsoDateFromUnix` | epoch 0 → "1970-01-01"; one known timestamp; single-digit month/day zero-padded; timezone-independent (uses `getUTC*`) |
| `computeLumpSum` | normal case (totalStxIn=100, totalSbtcOut=0.01, stxUsd=2, btcUsd=50000 → lumpSumSbtc=0.004, deltaSbtc=0.006, deltaPct=150); guards `stxUsdAtRef<=0`, `btcUsdAtRef<=0`, `totalStxIn<=0` each → null |
| `aggregatePlanPerformance` | empty events → zeros / null timestamps / empty `successfulEvents`; filters non-success and events missing `sbtcReceived` or `netSwapped`; sorts ascending by `blockTime` (first/last timestamps); sums + converts micro→STX (/1e6) and sats→sBTC (/1e8); `avgStxPerSbtc` = totalStxIn/totalSbtcOut, and 0 when totalSbtcOut=0 |
| `batchedMap` | preserves input→output order; respects concurrency (track max concurrent calls); empty input → `[]`; default concurrency = 3; propagates `fn` rejection |

### `src/lib/dca-sbtc.test.ts` (extend, keep existing 5 tests)

| Function | Test cases |
|---|---|
| `blocksToInterval` (sBTC) | same mapping table as `dca.ts` (note: verbatim duplicate) |
| `satsToBTC` | decimals 8 (150_000_000 → 1.5); 0 → 0 |
| `btcToSats` | 1.5 → 150_000_000; floor drops dust; round-trips with `satsToBTC` |

## Bug watchlist (flag at end — do NOT fix this round)

- **Dust loss:** `tokenToMicro` and `btcToSats` use `Math.floor`, silently
  dropping sub-micro / sub-sat amounts.
- **`computeLumpSum` dead branch + no NaN guard:** the `deltaPct = 0` path
  (when `lumpSumSbtc <= 0`) appears unreachable given the input guards; and the
  guards only reject `<= 0`, not `NaN`.
- **DRY:** `blocksToInterval` is duplicated verbatim across `dca.ts` and
  `dca-sbtc.ts`.

## Success criteria

- All 12 functions covered (happy path + edges + guards).
- `npm test` green; new tests add to the existing 96.
- **Zero production logic changed** — characterization only; findings reported
  in a summary, not patched here.
- Commits at house-style granularity (logical / per-function), each green.

## Out of scope

- Contract-call parameter builders (`createPlan`, `depositToPlan`,
  `executePlan`, `cancelPlan`, `pausePlan`, `resumePlan`, and sBTC variants).
- On-chain readers (`getPlan`, `getUserPlans`, `getPlanExecutionHistory`, …).
- Fixing any bug surfaced by the watchlist.
- `#5` Vercel CLI upgrade and `.gitkeep` housekeeping (separate trivial tasks).
