# DCA pure-function test watchlist — 2026-05-29

Behaviors locked by the new characterization tests that look suspicious.
**None fixed** — listed here for a future decision.

## 1. Silent dust loss (Math.floor)
`tokenToMicro` (dca.ts) and `btcToSats` (dca-sbtc.ts) floor the scaled amount,
so sub-micro / sub-sat inputs round down to 0 with no warning. Locked by the
"dust loss" tests. Impact: amounts below 1 micro-STX / 1 sat vanish.

## 2. computeLumpSum — dead branch + missing NaN guard
- The `deltaPct = 0` fallback (when `lumpSumSbtc <= 0`) is unreachable: the
  input guards already require `totalStxIn > 0`, `stxUsdAtRef > 0`,
  `btcUsdAtRef > 0`, which forces `lumpSumSbtc > 0`.
- Guards reject only `<= 0`, not `NaN`. A `NaN` price would propagate into
  `lumpSumSbtc` / `deltaPct` and reach the UI.

## 3. blocksToInterval duplicated verbatim
Identical implementation in `dca.ts:57` and `dca-sbtc.ts:40`. DRY candidate
(e.g. a shared `src/lib/domain/...` helper) once someone touches it.
