# Đợt 1 — Swap / Trade tab fixes (design spec)

Date: 2026-05-19
Scope: three independent, low-risk fixes to the swap feature and Trade tab.
Order chosen by risk: false/misleading copy → fee footgun → float money-math gate.

## Goals

1. **#4** — Remove copy that lies to the user (claims the app does not back up).
2. **#2** — Warn the user when a non-STX swap is likely to fail for lack of STX fee.
3. **#3** — Make the balance gate use exact integer (BigInt) math like the rest of
   the money path, instead of `parseFloat`.

Non-goals: aggregator integration (ROUTE_TABLE is final per prior git history),
USD value display (#5, later batch), accessibility/polling (later batch).

---

## #4 — Fix false copy in `src/app/trade/page.tsx`

Decision: **minimal factual fix only.** Keep the two info panels and the
four-item Swap Tips structure. Change only the statements that are false.

Verified facts:
- `ROUTE_TABLE` in `src/lib/direct-swap.ts` is a fixed route per pair. There is
  no aggregation, no "optimal path" selection.
- `SWAP_TOKENS` contains only `stx`, `sbtc`, `usdcx`. "USDA" and "ALEX" do not
  exist in this app.
- The `Assets` tab (`src/app/assets/page.tsx`) and `HealthScore`
  (`src/components/assets/HealthScore.tsx`) **do exist** — the tip referencing
  them is accurate and is kept unchanged.

Changes:

- **Line ~56–60, "Best Routes" panel.** Title "Best Routes" → "On-chain
  Routing". Body "Aggregates multiple DEX pools to find the optimal swap path
  with lowest slippage." → a true statement, e.g. *"Routes swaps through
  Bitflow Pools using live on-chain quotes, with slippage protection enforced
  by the contract."*
- **Line ~82, tip about multi-hop.** "Multi-hop routes (e.g. STX → USDA →
  ALEX) often give better rates than direct pairs." → a true statement about
  the actual fixed routes, e.g. *"sBTC → USDCx automatically routes multi-hop
  through STX and aeUSDC — the path is fixed and you don't pick it."*
- **"Real Yield" panel** and the other three tips (slippage 0.5%, HealthScore
  on Assets tab, large-trade price impact): **unchanged** — all factually
  correct.

No tests; verified by `npm run build` and reading the rendered Trade page.

---

## #2 — Warn on insufficient STX for fee (`src/components/trade/SwapWidget.tsx`)

Decision: **soft warning, do NOT block the Swap button.**

- New constant in `src/lib/direct-swap.ts`:
  ```ts
  /** Approximate STX kept free to pay a single swap contract-call fee. Below
   *  this, a non-STX swap will likely revert for lack of fee. Heuristic, not
   *  a fee estimate — intentionally no extra RPC. */
  export const MIN_STX_FOR_FEE = 0.05;
  ```
- New pure helper in `src/lib/direct-swap.ts`:
  ```ts
  /** True when the user is spending a non-STX token and their STX balance is
   *  too low to likely cover the transaction fee. */
  export function lacksStxForFee(fromId: string, stxBalanceHuman: number): boolean
  ```
  Returns `false` when `fromId === "stx"` (the gas-reserve logic already
  handles that path) and when `stxBalanceHuman` is unknown handling is the
  caller's concern (helper takes a number).
- In `SwapWidget`: add `stxBalance` state.
  - If `fromToken.id === "stx"`, reuse `fromBalance` (no second fetch).
  - Else fetch the STX balance in parallel with the from-token balance (reuse
    `fetchTokenBalance(stxAddress, stxSwapToken)` against the STX entry of
    `SWAP_TOKENS`). Same cancellation/`balanceNonce` pattern as the existing
    balance effect.
- Render: when `stxBalance !== null` AND `lacksStxForFee(fromToken.id,
  stxBalance)` is true AND there is an entered amount, show a **yellow**
  warning banner near the existing
  warnings: *"Low STX balance — you may not have enough STX to cover the
  transaction fee."* Use the same yellow styling as the `slippageWarning`
  "low" case (`rgb(234,179,8)`).
- The Swap button `disabled` condition is **unchanged** (user chose not to
  block).

---

## #3 — Balance gate uses BigInt (`src/components/trade/SwapWidget.tsx`)

Decision: convert both sides to raw integer units at the comparison point. Do
not refactor the balance-fetch plumbing (`fetchTokenBalance` still returns a
human number).

- New pure helper in `src/lib/direct-swap.ts`:
  ```ts
  /** True when amountIn (human string) strictly exceeds balanceHuman, compared
   *  in raw integer units so 8-decimal edges are exact (no float drift). */
  export function exceedsBalance(
    amountIn: string,
    balanceHuman: number,
    decimals: number
  ): boolean {
    return toRawAmount(amountIn, decimals) > toRawAmount(balanceHuman, decimals);
  }
  ```
- Replace the three `parseFloat(amountIn) > fromBalance` sites in
  `SwapWidget.tsx` with `exceedsBalance(amountIn, fromBalance, fromToken.decimals)`:
  1. input field red style (~line 603)
  2. "Insufficient balance" message (~line 612)
  3. Swap button `disabled` condition (~line 817)
  Each guarded by the existing `fromBalance !== null` check (helper is only
  called when balance is known).

---

## Testing

`src/lib/direct-swap.test.ts` — add cases, must not break existing
characterization tests:

- `exceedsBalance`:
  - equal to balance → `false` (e.g. sBTC `"0.00000334"` vs `0.00000334`)
  - one sat over → `true`
  - empty / NaN amount → `false`
  - native STX human value with float-lossy magnitude → exact
- `lacksStxForFee`:
  - `fromId === "stx"` → always `false`
  - non-STX, balance `0` → `true`
  - non-STX, balance `≥ MIN_STX_FOR_FEE` → `false`
  - non-STX, balance just below `MIN_STX_FOR_FEE` → `true`

Commands before commit: `npm test` (unit) and `npm run build`.

## Commit plan (fine-grained, each green)

1. `feat(swap): add exceedsBalance + lacksStxForFee helpers + tests` (helpers
   and their tests together — pure, no consumer yet).
2. `fix(swap): use BigInt balance gate in SwapWidget` (#3 wiring).
3. `feat(swap): warn when STX balance too low for fee` (#2 wiring: state +
   parallel fetch + yellow banner).
4. `docs(trade): correct misleading routing/aggregation copy` (#4).

No `Co-Authored-By` trailer (per user convention).
