# Direct-swap Domain Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `src/lib/direct-swap.ts` into `domain/`, `infra/`, `app/` layers under `src/lib/`, with a barrel re-export keeping its public API byte-identical.

**Architecture:** Move pure code (data, math, validation, CV value-objects) into `src/lib/domain/swap/`, the Hiro read-only adapter into `src/lib/infra/stacks/`, and the orchestrator (`getQuote`) into `src/lib/app/swap/`. `src/lib/direct-swap.ts` becomes a barrel of re-exports so the 4 external consumers and the characterization test file (`src/lib/direct-swap.test.ts`) need no changes. Six commits, each one leaves the repo green.

**Tech Stack:** TypeScript, Next.js 15 App Router, `@stacks/transactions` (pure CV constructors), Vitest (characterization tests), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-23-direct-swap-domain-extraction-design.md`

**Commit style** (per project memory): no `Co-Authored-By` trailer; fine-grained commits; each commit must keep `npm test` and `npm run build` green.

---

## Background notes for the implementer

- The current file `src/lib/direct-swap.ts` (686 lines) mixes 4 concerns: pure data (token registry, route table), pure math/validation utilities, Clarity value-object builders (post-conditions, swap-call args), and a Hiro read-only orchestrator (`getQuote`).
- The characterization test file `src/lib/direct-swap.test.ts` (427 lines) imports 19 symbols from `./direct-swap` and asserts byte-identical output of `buildSwapParams` for each of the 3 routes. It does NOT call `getQuote` (no network). Treat any test break as a refactor bug, not a test that needs updating.
- 4 external consumers (`src/components/trade/SwapWidget.tsx`, `src/components/trade/SwapPairChart.tsx`, `src/hooks/useMarketData.ts`, `src/lib/server/market-snapshot.ts`) import from `@/lib/direct-swap`. They must keep working without edits.
- Token contract constants (`SBTC`, `WSTX`, `AEUSDC`, `USDCX`, pool refs, router refs, core refs) currently sit in lines 21–41 of `direct-swap.ts`. They are pure data shared between `SWAP_TOKENS` (display registry) and `ROUTE_TABLE` (on-chain references). **Decision:** they live in `src/lib/domain/swap/contracts.ts` (a small new file), imported by both `tokens.ts` and `routes.ts`. This avoids any circular import.
- `ROUTES` is a private const derived from `ROUTE_TABLE` (line 193). It moves to `routes.ts` and stays private to that module — its consumers (`getRoute`, `getValidDestinations`, `getSwappableFromTokens`) move with it.

## File map (post-refactor)

```
src/lib/
├── direct-swap.ts                   # ~15-line barrel of re-exports
├── direct-swap.test.ts              # unchanged
├── domain/swap/
│   ├── contracts.ts                 # SBTC, WSTX, AEUSDC, USDCX, POOL_*, ROUTER_*, XYK_CORE_*, SS_CORE_* — pure constants + TokenRef type
│   ├── tokens.ts                    # SwapToken, SWAP_TOKENS, SWAP_TOKEN_USD, SWAP_PRICE_GECKO_IDS
│   ├── routes.ts                    # SwapRoute, QuoteHop, ExecSpec, RouteSpec, ROUTE_TABLE, getRoute, getValidDestinations, getSwappableFromTokens
│   ├── amount.ts                    # toRawAmount, applySlippageFloor, sanitizeAmountInput, amountForPercent, exceedsBalance, STX_GAS_RESERVE
│   ├── limits.ts                    # MIN_SWAP_RAW, MIN_STX_FOR_FEE, minSwapHuman, isBelowMinSwap, lacksStxForFee, slippageWarning
│   ├── quote-math.ts                # QuoteResult, quoteRate, computePriceImpact, QUOTE_TTL_MS, isQuoteStale, quoteSecondsLeft
│   ├── usd.ts                       # resolveUnitUsd, formatUsd
│   └── clarity.ts                   # SwapParams, cvToHex, unwrapOkUint, senderSpendPostCondition, buildSwapParams
├── infra/stacks/
│   └── read-only.ts                 # callReadOnly (fetch → ClarityValue)
└── app/swap/
    └── quote.ts                     # getQuote, quoteHop, quoteRawOut
```

Note on `STX_GAS_RESERVE`: it sits in `amount.ts` because `amountForPercent` uses it. `MIN_STX_FOR_FEE` sits in `limits.ts` because `lacksStxForFee` uses it.

---

## Verification commands (used at every task)

```bash
npm test -- src/lib/direct-swap.test.ts
npm run build
```

Both must pass after every commit. The first runs Vitest's characterization tests against the barrel. The second proves TypeScript can resolve every consumer's imports through the re-export chain.

---

## Task 1: Scaffold layer directories and verify baseline green

**Files:**
- Create: `src/lib/domain/.gitkeep`
- Create: `src/lib/infra/.gitkeep`
- Create: `src/lib/app/.gitkeep`

- [ ] **Step 1: Confirm baseline is green before any refactor**

Run:
```bash
npm test -- src/lib/direct-swap.test.ts
```
Expected: All tests in `direct-swap.test.ts` pass. Note the test count — it must stay the same throughout the refactor.

Then run:
```bash
npm run build
```
Expected: Build succeeds.

If either fails on baseline, STOP. The refactor cannot start from a broken state.

- [ ] **Step 2: Create empty layer directories**

```bash
mkdir -p src/lib/domain/swap src/lib/infra/stacks src/lib/app/swap
touch src/lib/domain/.gitkeep src/lib/infra/.gitkeep src/lib/app/.gitkeep
```

- [ ] **Step 3: Verify still green (no-op change)**

```bash
npm test -- src/lib/direct-swap.test.ts
npm run build
```
Expected: Both pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/domain src/lib/infra src/lib/app
git commit -m "refactor(direct-swap): scaffold domain/infra/app layer dirs"
```

---

## Task 2: Extract contract constants + token registry + routes

**Goal:** Move all pure data — contract constants, `SWAP_TOKENS` registry, `ROUTE_TABLE` and its resolvers — into `domain/swap/`. `direct-swap.ts` re-exports them.

**Files:**
- Create: `src/lib/domain/swap/contracts.ts`
- Create: `src/lib/domain/swap/tokens.ts`
- Create: `src/lib/domain/swap/routes.ts`
- Modify: `src/lib/direct-swap.ts` (remove moved code, add re-exports)

- [ ] **Step 1: Create `src/lib/domain/swap/contracts.ts`**

```ts
// src/lib/domain/swap/contracts.ts
// Pure on-chain contract references. No I/O. Shared by tokens.ts (display
// registry) and routes.ts (on-chain quote/exec wiring).

export type TokenRef = { address: string; name: string };

// XYK Core
export const XYK_CORE_ADDRESS = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
export const XYK_CORE_NAME = "xyk-core-v-1-2";
export const XYK_CORE: TokenRef = { address: XYK_CORE_ADDRESS, name: XYK_CORE_NAME };

// Stableswap Core
export const SS_CORE_ADDRESS = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
export const SS_CORE_NAME = "stableswap-core-v-1-4";

// Pools
export const POOL_SBTC_STX: TokenRef = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "xyk-pool-sbtc-stx-v-1-1" };
export const POOL_STX_AEUSDC: TokenRef = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "xyk-pool-stx-aeusdc-v-1-2" };
export const POOL_AEUSDC_USDCX: TokenRef = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "stableswap-pool-aeusdc-usdcx-v-1-1" };

// Routers
export const ROUTER_STX_SBTC: TokenRef = { address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV", name: "bitflow-sbtc-swap-router" };
export const ROUTER_SBTC_USDCX: TokenRef = { address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV", name: "bitflow-usdcx-swap-router" };

// Tokens
export const SBTC: TokenRef = { address: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", name: "sbtc-token" };
export const WSTX: TokenRef = { address: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", name: "token-stx-v-1-2" };
export const AEUSDC: TokenRef = { address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", name: "token-aeusdc" };
export const USDCX: TokenRef = { address: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE", name: "usdcx" };
```

- [ ] **Step 2: Create `src/lib/domain/swap/tokens.ts`**

```ts
// src/lib/domain/swap/tokens.ts
// User-facing swap token registry + USD price source mapping. Pure data.

import { SBTC, USDCX } from "./contracts";

export interface SwapToken {
  id: string;
  symbol: string;
  name: string;
  contract: string | null; // null for native STX
  decimals: number;
  icon: string;
}

export const SWAP_TOKENS: SwapToken[] = [
  { id: "stx", symbol: "STX", name: "Stacks", contract: null, decimals: 6, icon: "/tokens/stx.svg" },
  { id: "sbtc", symbol: "sBTC", name: "sBTC", contract: `${SBTC.address}.${SBTC.name}`, decimals: 8, icon: "/tokens/sbtc.svg" },
  { id: "usdcx", symbol: "USDCx", name: "USD Coin", contract: `${USDCX.address}.${USDCX.name}`, decimals: 6, icon: "/tokens/usdcx.svg" },
];

// ─── USD valuation ─────────────────────────────────────────────────────────
// Maps each swap token to its USD price source. geckoId = CoinGecko id used
// by the existing /api/coingecko proxy; fixedUsd = stablecoin pegged to $1
// (no fetch). IDs reuse the verified mapping already in lib/stacks.ts — not
// guessed.

export const SWAP_TOKEN_USD: Record<
  string,
  { geckoId: string | null; fixedUsd?: number }
> = {
  stx: { geckoId: "blockstack" },
  sbtc: { geckoId: "bitcoin" },
  usdcx: { geckoId: null, fixedUsd: 1 },
};

/** Deduped, non-null CoinGecko ids that must be fetched to price swap tokens. */
export const SWAP_PRICE_GECKO_IDS: string[] = [
  ...new Set(
    Object.values(SWAP_TOKEN_USD)
      .map((s) => s.geckoId)
      .filter((id): id is string => id !== null)
  ),
];
```

- [ ] **Step 3: Create `src/lib/domain/swap/routes.ts`**

```ts
// src/lib/domain/swap/routes.ts
// Data-driven route table: single source of truth for every quote + exec
// wiring. Adding a pair is a data change; a missing field is a compile error
// (not a runtime crash at sign time).

import {
  AEUSDC,
  POOL_AEUSDC_USDCX,
  POOL_SBTC_STX,
  POOL_STX_AEUSDC,
  ROUTER_SBTC_USDCX,
  ROUTER_STX_SBTC,
  SBTC,
  SS_CORE_ADDRESS,
  SS_CORE_NAME,
  USDCX,
  WSTX,
  XYK_CORE,
  XYK_CORE_ADDRESS,
  XYK_CORE_NAME,
  type TokenRef,
} from "./contracts";
import { SWAP_TOKENS, type SwapToken } from "./tokens";

export type SwapRoute = {
  from: string;
  to: string;
  method: "router" | "direct";
  hops: string[];
};

/** One read-only hop. Read args are always [pool, xToken, yToken, uint(amt)];
 *  the output feeds the next hop's amount. */
export interface QuoteHop {
  coreAddress: string;
  coreName: string;
  fn: "get-dx" | "get-dy";
  pool: TokenRef;
  xToken: TokenRef;
  yToken: TokenRef;
}

/** How the swap is executed on-chain. `router` = aggregator entrypoint
 *  (amount, minOut, sender); `direct` = raw xyk-core (pool+tokens, amount,
 *  minOut). */
export type ExecSpec =
  | { kind: "router"; contract: TokenRef; fn: string }
  | {
      kind: "direct";
      contract: TokenRef;
      fn: string;
      pool: TokenRef;
      xToken: TokenRef;
      yToken: TokenRef;
    };

export interface RouteSpec extends SwapRoute {
  quote: QuoteHop[];
  exec: ExecSpec;
}

export const ROUTE_TABLE: RouteSpec[] = [
  {
    from: "stx",
    to: "sbtc",
    method: "router",
    hops: ["STX", "sBTC"],
    quote: [
      {
        coreAddress: XYK_CORE_ADDRESS,
        coreName: XYK_CORE_NAME,
        fn: "get-dx",
        pool: POOL_SBTC_STX,
        xToken: SBTC,
        yToken: WSTX,
      },
    ],
    exec: { kind: "router", contract: ROUTER_STX_SBTC, fn: "swap-stx-for-token" },
  },
  {
    from: "sbtc",
    to: "stx",
    method: "direct",
    hops: ["sBTC", "STX"],
    quote: [
      {
        coreAddress: XYK_CORE_ADDRESS,
        coreName: XYK_CORE_NAME,
        fn: "get-dy",
        pool: POOL_SBTC_STX,
        xToken: SBTC,
        yToken: WSTX,
      },
    ],
    exec: {
      kind: "direct",
      contract: XYK_CORE,
      fn: "swap-x-for-y",
      pool: POOL_SBTC_STX,
      xToken: SBTC,
      yToken: WSTX,
    },
  },
  {
    from: "sbtc",
    to: "usdcx",
    method: "router",
    hops: ["sBTC", "STX", "aeUSDC", "USDCx"],
    quote: [
      {
        coreAddress: XYK_CORE_ADDRESS,
        coreName: XYK_CORE_NAME,
        fn: "get-dy",
        pool: POOL_SBTC_STX,
        xToken: SBTC,
        yToken: WSTX,
      },
      {
        coreAddress: XYK_CORE_ADDRESS,
        coreName: XYK_CORE_NAME,
        fn: "get-dy",
        pool: POOL_STX_AEUSDC,
        xToken: WSTX,
        yToken: AEUSDC,
      },
      {
        coreAddress: SS_CORE_ADDRESS,
        coreName: SS_CORE_NAME,
        fn: "get-dy",
        pool: POOL_AEUSDC_USDCX,
        xToken: AEUSDC,
        yToken: USDCX,
      },
    ],
    exec: {
      kind: "router",
      contract: ROUTER_SBTC_USDCX,
      fn: "swap-sbtc-for-token",
    },
  },
];

/** Display/resolver view of the table — the only place routes are listed. */
const ROUTES: SwapRoute[] = ROUTE_TABLE.map(({ from, to, method, hops }) => ({
  from,
  to,
  method,
  hops,
}));

export function getRoute(fromId: string, toId: string): SwapRoute | null {
  return ROUTES.find((r) => r.from === fromId && r.to === toId) ?? null;
}

export function getValidDestinations(fromId: string): SwapToken[] {
  const validIds = ROUTES.filter((r) => r.from === fromId).map((r) => r.to);
  return SWAP_TOKENS.filter((t) => validIds.includes(t.id));
}

export function getSwappableFromTokens(): SwapToken[] {
  const fromIds = [...new Set(ROUTES.map((r) => r.from))];
  return SWAP_TOKENS.filter((t) => fromIds.includes(t.id));
}
```

- [ ] **Step 4: Update `src/lib/direct-swap.ts` to re-export the new files and remove the moved code**

Delete the original contract constants (lines 17–41), the `SwapToken` interface + `SWAP_TOKENS` array (lines 45–58), the `SwapRoute` type, `TokenRef` type, `QuoteHop` interface, `ExecSpec` type, `RouteSpec` interface, `XYK_CORE` const, `ROUTE_TABLE`, `ROUTES`, `getRoute`, `getValidDestinations`, `getSwappableFromTokens` (lines 62–212), `SWAP_TOKEN_USD`, and `SWAP_PRICE_GECKO_IDS` (lines 433–449). Add at the very top of the file, after the existing `import { ... } from "@stacks/transactions"` block:

```ts
export type { SwapToken } from "./domain/swap/tokens";
export {
  SWAP_TOKENS,
  SWAP_TOKEN_USD,
  SWAP_PRICE_GECKO_IDS,
} from "./domain/swap/tokens";
export type { SwapRoute } from "./domain/swap/routes";
export {
  getRoute,
  getValidDestinations,
  getSwappableFromTokens,
} from "./domain/swap/routes";

// Internal: still used by quote/builder below until they move in later tasks.
import { ROUTE_TABLE } from "./domain/swap/routes";
import { SWAP_TOKENS } from "./domain/swap/tokens";
```

(`ROUTE_TABLE` and `SWAP_TOKENS` are imported privately because the `getQuote`/`buildSwapParams` code still in `direct-swap.ts` references them. They will move out in Tasks 4 and 6.)

- [ ] **Step 5: Verify green**

```bash
npm test -- src/lib/direct-swap.test.ts
npm run build
```
Expected: All tests pass. Build succeeds.

If a test fails with "X is not exported", check that the re-export line for X is present and spelled identically.

- [ ] **Step 6: Commit**

```bash
git add src/lib/domain/swap/contracts.ts src/lib/domain/swap/tokens.ts src/lib/domain/swap/routes.ts src/lib/direct-swap.ts
git commit -m "refactor(direct-swap): extract token registry + route table to domain/swap"
```

---

## Task 3: Extract amount, limits, quote-math, USD utilities

**Goal:** Move the four families of pure utility functions to dedicated files. No CV/Stacks SDK references in these files.

**Files:**
- Create: `src/lib/domain/swap/amount.ts`
- Create: `src/lib/domain/swap/limits.ts`
- Create: `src/lib/domain/swap/quote-math.ts`
- Create: `src/lib/domain/swap/usd.ts`
- Modify: `src/lib/direct-swap.ts`

- [ ] **Step 1: Create `src/lib/domain/swap/amount.ts`**

```ts
// src/lib/domain/swap/amount.ts
// Money math kept in BigInt where the on-chain amount is the value. Float
// `human * 10**decimals` loses precision for 8-decimal tokens with large
// integer parts — these helpers don't.

/**
 * STX kept back when the user taps MAX, so the swap transaction can still
 * pay its contract-call fee. Native STX is both the asset being spent and
 * the fee currency — without this buffer a 100% STX swap always reverts.
 */
export const STX_GAS_RESERVE = 0.1;

/**
 * Convert a human-readable amount to raw integer units without float math.
 * `1.5` STX → `1500000n`. Fraction beyond `decimals` is truncated (floor),
 * matching on-chain behaviour.
 */
export function toRawAmount(human: string | number, decimals: number): bigint {
  const str = typeof human === "number" ? human.toFixed(decimals) : human.trim();
  if (!str || isNaN(Number(str))) return 0n;
  const neg = str.startsWith("-");
  const [intPart, fracPart = ""] = str.replace(/^[+-]/, "").split(".");
  const frac = fracPart.slice(0, decimals).padEnd(decimals, "0");
  const raw = BigInt((intPart || "0") + frac);
  return neg ? -raw : raw;
}

/**
 * Apply a slippage tolerance (percent) to a raw output amount, flooring.
 * `applySlippageFloor(1000000n, 0.5)` → `995000n`. Uses basis points so
 * fractional percents stay exact.
 */
export function applySlippageFloor(
  amountOutRaw: bigint,
  slippagePercent: number
): bigint {
  const bps = BigInt(Math.round(slippagePercent * 100));
  return (amountOutRaw * (10000n - bps)) / 10000n;
}

/**
 * Sanitize a raw `<input>` value into a safe decimal string: digits and a
 * single dot only (no `e`/`+`/`-`/exponent/locale separators), fraction
 * truncated to the token's decimals. Keeps the amount field from ever
 * holding a value the contract math can't represent.
 */
export function sanitizeAmountInput(raw: string, decimals: number): string {
  if (!raw) return "";
  let s = raw.replace(/[^0-9.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s =
      s.slice(0, firstDot + 1) +
      s.slice(firstDot + 1).replace(/\./g, "");
  }
  if (s.startsWith(".")) s = "0" + s;
  const dot = s.indexOf(".");
  if (dot !== -1 && decimals >= 0) {
    s = s.slice(0, dot + 1 + decimals);
  }
  return s;
}

/**
 * Amount (human string) to put in the input when a balance-percent shortcut
 * is tapped. For a native-STX MAX it subtracts the gas reserve; everything
 * else is a straight `balance * pct`. Result is capped at 6 decimals.
 */
export function amountForPercent(
  balance: number,
  pct: number,
  isNativeStx: boolean,
  decimals: number
): string {
  let val = balance * pct;
  if (isNativeStx && pct >= 1) {
    val = Math.max(balance - STX_GAS_RESERVE, 0);
  }
  const places = Math.min(decimals, 6);
  return parseFloat(val.toFixed(places)).toString();
}

/**
 * True when `amountIn` (a human decimal string) strictly exceeds
 * `balanceHuman`, compared in raw integer units — consistent with how every
 * other money comparison in this module works (via `toRawAmount`) and immune
 * to any decimal-precision edge. Caller must only pass a known balance.
 */
export function exceedsBalance(
  amountIn: string,
  balanceHuman: number,
  decimals: number
): boolean {
  return toRawAmount(amountIn, decimals) > toRawAmount(balanceHuman, decimals);
}
```

- [ ] **Step 2: Create `src/lib/domain/swap/limits.ts`**

```ts
// src/lib/domain/swap/limits.ts
// Constraints the on-chain swap will enforce — surface them in the UI so the
// user can't burn fees on a guaranteed revert.

import { SWAP_TOKENS } from "./tokens";
import { toRawAmount } from "./amount";

/**
 * Smart-contract minimum swap size, in raw units, keyed by source token.
 * Submitting below this reverts on-chain and wastes the user's tx fee, so
 * the UI must block it first. (1 STX / 334 sats sBTC.)
 */
export const MIN_SWAP_RAW: Record<string, bigint> = {
  stx: 1_000_000n, // 1 STX
  sbtc: 334n, // 334 sats
};

/**
 * Approximate STX kept free to pay a single swap contract-call fee. Below
 * this, a non-STX swap will likely revert for lack of fee. Heuristic, not a
 * fee estimate — intentionally avoids an extra RPC.
 */
export const MIN_STX_FOR_FEE = 0.05;

/** Human-readable minimum swap amount for a source token (0 if unconstrained). */
export function minSwapHuman(fromId: string): number {
  const raw = MIN_SWAP_RAW[fromId];
  if (raw === undefined) return 0;
  const token = SWAP_TOKENS.find((t) => t.id === fromId);
  return Number(raw) / Math.pow(10, token?.decimals ?? 0);
}

/** True when `amountInHuman` is below the contract minimum for `fromId`. */
export function isBelowMinSwap(
  fromId: string,
  amountInHuman: string | number
): boolean {
  const min = MIN_SWAP_RAW[fromId];
  if (min === undefined) return false;
  const token = SWAP_TOKENS.find((t) => t.id === fromId);
  const raw = toRawAmount(amountInHuman, token?.decimals ?? 0);
  return raw < min;
}

/**
 * True when the user spends a non-STX token and their STX balance is too low
 * to likely cover the transaction fee. Always false when the source IS STX —
 * the MAX gas-reserve logic handles that path.
 */
export function lacksStxForFee(
  fromId: string,
  stxBalanceHuman: number
): boolean {
  if (fromId === "stx") return false;
  return stxBalanceHuman < MIN_STX_FOR_FEE;
}

/**
 * Classify a slippage tolerance (percent). Above 5% the user risks a bad
 * fill / MEV; below 0.05% the swap will likely revert on any price move.
 * `null` means the value is in the sensible range.
 */
export function slippageWarning(pct: number): "high" | "low" | null {
  if (pct > 5) return "high";
  if (pct < 0.05) return "low";
  return null;
}
```

- [ ] **Step 3: Create `src/lib/domain/swap/quote-math.ts`**

```ts
// src/lib/domain/swap/quote-math.ts
// Pure quote-derived math: rate, price impact, staleness. No I/O.

import type { SwapRoute } from "./routes";

export interface QuoteResult {
  amountOut: number;       // raw units (micro/sats)
  amountOutHuman: number;  // human-readable
  route: SwapRoute;
  quotedAt: number;        // Date.now() when fetched — see isQuoteStale
  priceImpact: number;     // fraction (0.05 = 5%); 0 if not computable
}

/**
 * Effective exchange rate from a quote: how much output 1 unit of input
 * buys. Display-only (a ratio is fine as a float). 0 if not computable.
 */
export function quoteRate(
  amountInHuman: number,
  amountOutHuman: number
): number {
  if (!(amountInHuman > 0) || !(amountOutHuman > 0)) return 0;
  return amountOutHuman / amountInHuman;
}

/**
 * Price impact as a fraction (0.05 = 5%): how much worse the user's
 * effective rate is than the near-spot rate from a tiny reference trade.
 * Returns 0 if it can't be computed or if the effective rate is somehow
 * better than spot.
 */
export function computePriceImpact(
  refAmountInRaw: number,
  refAmountOutRaw: number,
  amountInRaw: number,
  amountOutRaw: number
): number {
  if (
    refAmountInRaw <= 0 ||
    refAmountOutRaw <= 0 ||
    amountInRaw <= 0 ||
    amountOutRaw <= 0
  ) {
    return 0;
  }
  const spotRate = refAmountOutRaw / refAmountInRaw;
  const effectiveRate = amountOutRaw / amountInRaw;
  return Math.max(0, 1 - effectiveRate / spotRate);
}

/** A quote older than this is considered stale and must be refreshed. */
export const QUOTE_TTL_MS = 30_000;

/** True once a quote taken at `quotedAt` has aged past {@link QUOTE_TTL_MS}. */
export function isQuoteStale(quotedAt: number, now: number = Date.now()): boolean {
  return now - quotedAt > QUOTE_TTL_MS;
}

/**
 * Whole seconds remaining before a quote taken at `quotedAt` auto-refreshes,
 * for the countdown UI. Clamped to `[0, QUOTE_TTL_MS/1000]` so clock skew
 * (now < quotedAt) can't show more than the full window, and an expired
 * quote reads 0 rather than negative.
 */
export function quoteSecondsLeft(
  quotedAt: number,
  now: number = Date.now()
): number {
  const secs = Math.ceil((QUOTE_TTL_MS - (now - quotedAt)) / 1000);
  return Math.min(QUOTE_TTL_MS / 1000, Math.max(0, secs));
}
```

- [ ] **Step 4: Create `src/lib/domain/swap/usd.ts`**

```ts
// src/lib/domain/swap/usd.ts
// USD display helpers. Pure — consumes a price map provided by the caller.

import { SWAP_TOKEN_USD } from "./tokens";

/**
 * USD price of ONE unit of a swap token. `prices` is the CoinGecko
 * simple/price shape (`{ [geckoId]: { usd: number } }`). Returns `null`
 * when the price is unknown (token unmapped, id absent, not yet loaded, or
 * ≤ 0) so the UI can hide the figure instead of showing a misleading $0.
 */
export function resolveUnitUsd(
  tokenId: string,
  prices: Record<string, { usd: number }> | undefined
): number | null {
  const src = SWAP_TOKEN_USD[tokenId];
  if (!src) return null;
  if (src.geckoId === null) return src.fixedUsd ?? null;
  const usd = prices?.[src.geckoId]?.usd;
  return typeof usd === "number" && usd > 0 ? usd : null;
}

/**
 * Format a USD figure for display beside a swap amount. `null`/non-finite →
 * `null` (caller hides the line). A non-zero amount under a cent clamps to
 * "< $0.01" so it never renders as "$0.00".
 */
export function formatUsd(value: number | null): string | null {
  if (value === null || !isFinite(value)) return null;
  if (value === 0) return "$0.00";
  if (value > 0 && value < 0.01) return "< $0.01";
  return (
    "$" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
```

- [ ] **Step 5: Update `src/lib/direct-swap.ts` — remove moved code and add re-exports**

Delete from `direct-swap.ts`: `sanitizeAmountInput`, `slippageWarning`, `quoteRate`, `toRawAmount`, `applySlippageFloor`, `STX_GAS_RESERVE`, `MIN_SWAP_RAW`, `minSwapHuman`, `isBelowMinSwap`, `computePriceImpact`, `QUOTE_TTL_MS`, `isQuoteStale`, `quoteSecondsLeft`, `amountForPercent`, `exceedsBalance`, `MIN_STX_FOR_FEE`, `lacksStxForFee`, the `QuoteResult` interface, `resolveUnitUsd`, `formatUsd`.

Add to the top re-export block (after the Task 2 re-exports):

```ts
export {
  STX_GAS_RESERVE,
  toRawAmount,
  applySlippageFloor,
  sanitizeAmountInput,
  amountForPercent,
  exceedsBalance,
} from "./domain/swap/amount";
export {
  MIN_STX_FOR_FEE,
  minSwapHuman,
  isBelowMinSwap,
  lacksStxForFee,
  slippageWarning,
} from "./domain/swap/limits";
export type { QuoteResult } from "./domain/swap/quote-math";
export {
  quoteRate,
  computePriceImpact,
  QUOTE_TTL_MS,
  isQuoteStale,
  quoteSecondsLeft,
} from "./domain/swap/quote-math";
export { resolveUnitUsd, formatUsd } from "./domain/swap/usd";
```

Add to the internal-import block (so the still-resident `getQuote` and `buildSwapParams` keep compiling):

```ts
import { toRawAmount } from "./domain/swap/amount";
import { MIN_SWAP_RAW } from "./domain/swap/limits";
import { computePriceImpact } from "./domain/swap/quote-math";
```

`MIN_SWAP_RAW` is now exported from `limits.ts` (it was internal-only before; exporting it from the domain file is fine — the re-export above does not surface it publicly, matching the previous public API exactly).

- [ ] **Step 6: Verify green**

```bash
npm test -- src/lib/direct-swap.test.ts
npm run build
```
Expected: All tests pass. Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/domain/swap/amount.ts src/lib/domain/swap/limits.ts src/lib/domain/swap/quote-math.ts src/lib/domain/swap/usd.ts src/lib/direct-swap.ts
git commit -m "refactor(direct-swap): move amount/limits/quote-math/usd to domain/swap"
```

---

## Task 4: Extract Clarity helpers and swap-param builder

**Goal:** Move `cvToHex`, `unwrapOkUint`, `senderSpendPostCondition`, and `buildSwapParams` to `domain/swap/clarity.ts`. These use `@stacks/transactions` (pure CV builders, no I/O) so they belong in the domain layer per the spec.

**Files:**
- Create: `src/lib/domain/swap/clarity.ts`
- Modify: `src/lib/direct-swap.ts`

- [ ] **Step 1: Create `src/lib/domain/swap/clarity.ts`**

```ts
// src/lib/domain/swap/clarity.ts
// Clarity value-object builders for swap transactions. Pure — every helper
// builds an immutable value; no `fetch`, no signing, no broadcast.

import {
  contractPrincipalCV,
  standardPrincipalCV,
  uintCV,
  serializeCV,
  hexToCV,
  ClarityType,
  Pc,
  PostConditionMode,
  type PostCondition,
  type ClarityValue,
} from "@stacks/transactions";

import { SBTC } from "./contracts";
import { ROUTE_TABLE } from "./routes";
import { SWAP_TOKENS } from "./tokens";
import { toRawAmount } from "./amount";

export interface SwapParams {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditions: PostCondition[];
  postConditionMode: PostConditionMode;
}

export function cvToHex(cv: ClarityValue): string {
  const result = serializeCV(cv);
  if (typeof result === "string") return "0x" + result;
  return "0x" + Buffer.from(result as Uint8Array).toString("hex");
}

export function unwrapOkUint(cv: ClarityValue): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = cv as any;

  // String-based type (newer @stacks/transactions)
  if (raw.type === "ok") return Number(raw.value?.value ?? raw.value ?? 0);

  // Enum-based type (legacy)
  if (raw.type === ClarityType.ResponseOk) return Number(raw.value?.value ?? 0);

  throw new Error("Unexpected Clarity value type");
}

// hexToCV is re-exported for the infra read-only adapter (Task 5). It is a
// pure decoder, so keeping it routed through the domain layer is fine.
export { hexToCV };

const SBTC_ASSET = `${SBTC.address}.${SBTC.name}` as const;

/**
 * Post-condition guaranteeing the sender parts with EXACTLY `amountInRaw` of
 * the input token and nothing else of theirs leaves the wallet. Combined
 * with Deny mode this closes the catastrophic "contract drains more than
 * expected" vector. The minimum received amount is enforced on-chain by the
 * swap's `min-amount-out` argument, which reverts the tx if the output is
 * too low.
 */
function senderSpendPostCondition(
  fromId: string,
  amountInRaw: bigint,
  senderAddress: string
): PostCondition {
  if (fromId === "stx") {
    return Pc.principal(senderAddress).willSendEq(amountInRaw).ustx();
  }
  if (fromId === "sbtc") {
    return Pc.principal(senderAddress)
      .willSendEq(amountInRaw)
      .ft(SBTC_ASSET, SBTC.name);
  }
  throw new Error(`No post-condition rule for input token ${fromId}`);
}

export function buildSwapParams(
  fromId: string,
  toId: string,
  amountInHuman: string | number,
  minAmountOutRaw: bigint | number,
  senderAddress: string
): SwapParams {
  const spec = ROUTE_TABLE.find((r) => r.from === fromId && r.to === toId);
  if (!spec) throw new Error(`No swap builder for ${fromId} → ${toId}`);

  const fromToken = SWAP_TOKENS.find((t) => t.id === fromId)!;
  const amountInRaw = toRawAmount(amountInHuman, fromToken.decimals);
  const postConditions = [
    senderSpendPostCondition(fromId, amountInRaw, senderAddress),
  ];

  const e = spec.exec;
  const functionArgs: ClarityValue[] =
    e.kind === "router"
      ? [
          uintCV(amountInRaw),
          uintCV(minAmountOutRaw),
          standardPrincipalCV(senderAddress),
        ]
      : [
          contractPrincipalCV(e.pool.address, e.pool.name),
          contractPrincipalCV(e.xToken.address, e.xToken.name),
          contractPrincipalCV(e.yToken.address, e.yToken.name),
          uintCV(amountInRaw),
          uintCV(minAmountOutRaw),
        ];

  return {
    contractAddress: e.contract.address,
    contractName: e.contract.name,
    functionName: e.fn,
    functionArgs,
    postConditions,
    postConditionMode: PostConditionMode.Deny,
  };
}
```

- [ ] **Step 2: Update `src/lib/direct-swap.ts` — remove moved code and add re-exports**

Delete from `direct-swap.ts`: the `cvToHex` function, `unwrapOkUint` function, `SBTC_ASSET` const, `senderSpendPostCondition` function, `buildSwapParams` function, `SwapParams` interface.

Add to the re-export block:

```ts
export type { SwapParams } from "./domain/swap/clarity";
export { buildSwapParams } from "./domain/swap/clarity";
```

Add to the internal-import block (so the still-resident `quoteHop` / `getQuote` keep compiling):

```ts
import { cvToHex, unwrapOkUint, hexToCV } from "./domain/swap/clarity";
```

(After this task, `direct-swap.ts` no longer imports anything from `@stacks/transactions` directly except what `getQuote`/`quoteHop` need: `contractPrincipalCV`, `uintCV`, and `type ClarityValue`. Keep those imports.)

- [ ] **Step 3: Verify green**

```bash
npm test -- src/lib/direct-swap.test.ts
npm run build
```
Expected: All tests pass — characterization tests cover `buildSwapParams` for all 3 routes. Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/domain/swap/clarity.ts src/lib/direct-swap.ts
git commit -m "refactor(direct-swap): move clarity helpers + buildSwapParams to domain/swap"
```

---

## Task 5: Extract Hiro read-only adapter to infra

**Goal:** Move `callReadOnly` and its module-level constants (`HIRO_API`, `DUMMY_SENDER`) to `src/lib/infra/stacks/read-only.ts`. Internal to `direct-swap.ts` — not re-exported, since it was never part of the public API.

**Files:**
- Create: `src/lib/infra/stacks/read-only.ts`
- Modify: `src/lib/direct-swap.ts`

- [ ] **Step 1: Create `src/lib/infra/stacks/read-only.ts`**

```ts
// src/lib/infra/stacks/read-only.ts
// Adapter: Hiro `call-read` HTTP endpoint → ClarityValue. The only place in
// the swap stack that performs network I/O for read-only contract calls.
// Decodes via the domain-layer hexToCV.

import { hexToCV } from "@/lib/domain/swap/clarity";
import type { ClarityValue } from "@stacks/transactions";

const HIRO_API = "https://api.hiro.so";

// Any valid mainnet principal — the call is read-only, so the sender is
// never charged and never validated against state. Using a fixed address
// keeps the call deterministic.
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

export async function callReadOnly(
  contractAddress: string,
  contractName: string,
  functionName: string,
  args: string[]
): Promise<ClarityValue> {
  const res = await fetch(
    `${HIRO_API}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
    }
  );
  const data = await res.json();
  if (!data.okay) throw new Error(data.cause ?? "Read-only call failed");
  return hexToCV(data.result);
}
```

- [ ] **Step 2: Update `src/lib/direct-swap.ts`**

Delete from `direct-swap.ts`: the `HIRO_API` const, `DUMMY_SENDER` const, `callReadOnly` function, and the now-unused `hexToCV` import from `@stacks/transactions` (it's still imported via the internal `import { ..., hexToCV }` from Task 4 — drop that one too, since `callReadOnly` is leaving).

Replace the internal-imports block's clarity import with just the helpers `getQuote`/`quoteHop` still uses:

```ts
import { cvToHex, unwrapOkUint } from "./domain/swap/clarity";
import { callReadOnly } from "./infra/stacks/read-only";
```

- [ ] **Step 3: Verify green**

```bash
npm test -- src/lib/direct-swap.test.ts
npm run build
```
Expected: All tests pass (none of them call `getQuote` so this change is purely structural for the orchestrator). Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/infra/stacks/read-only.ts src/lib/direct-swap.ts
git commit -m "refactor(direct-swap): move Hiro read-only adapter to infra/stacks"
```

---

## Task 6: Move orchestrator to app layer; barrel-only `direct-swap.ts`

**Goal:** Move `quoteHop`, `quoteRawOut`, `getQuote` to `src/lib/app/swap/quote.ts`. After this task, `src/lib/direct-swap.ts` contains only re-exports.

**Files:**
- Create: `src/lib/app/swap/quote.ts`
- Modify: `src/lib/direct-swap.ts` (final barrel form)

- [ ] **Step 1: Create `src/lib/app/swap/quote.ts`**

```ts
// src/lib/app/swap/quote.ts
// Orchestrator: composes domain rules (route table, raw-unit math, price
// impact) with the infra read-only adapter to produce a swap quote.

import { contractPrincipalCV, uintCV } from "@stacks/transactions";

import { toRawAmount } from "@/lib/domain/swap/amount";
import { cvToHex, unwrapOkUint } from "@/lib/domain/swap/clarity";
import { MIN_SWAP_RAW } from "@/lib/domain/swap/limits";
import {
  computePriceImpact,
  type QuoteResult,
} from "@/lib/domain/swap/quote-math";
import {
  ROUTE_TABLE,
  getRoute,
  type QuoteHop,
} from "@/lib/domain/swap/routes";
import { SWAP_TOKENS } from "@/lib/domain/swap/tokens";
import { callReadOnly } from "@/lib/infra/stacks/read-only";

/**
 * One read-only quote hop. All cores (xyk/stableswap) expose the same
 * shape: `(get-dx|get-dy) pool xToken yToken uint` returning `(ok uint)`.
 */
async function quoteHop(hop: QuoteHop, amountInRaw: number): Promise<number> {
  const args = [
    cvToHex(contractPrincipalCV(hop.pool.address, hop.pool.name)),
    cvToHex(contractPrincipalCV(hop.xToken.address, hop.xToken.name)),
    cvToHex(contractPrincipalCV(hop.yToken.address, hop.yToken.name)),
    cvToHex(uintCV(amountInRaw)),
  ];
  const cv = await callReadOnly(hop.coreAddress, hop.coreName, hop.fn, args);
  return unwrapOkUint(cv);
}

/** Raw output for a raw input: chains the route's quote hops, feeding each
 *  hop's output into the next. Reads the same ROUTE_TABLE as buildSwapParams. */
async function quoteRawOut(
  fromId: string,
  toId: string,
  amountInRaw: number
): Promise<number> {
  const spec = ROUTE_TABLE.find((r) => r.from === fromId && r.to === toId);
  if (!spec) throw new Error(`No quote logic for ${fromId} → ${toId}`);
  let amt = amountInRaw;
  for (const hop of spec.quote) {
    amt = await quoteHop(hop, amt);
  }
  return amt;
}

export async function getQuote(
  fromId: string,
  toId: string,
  amountInHuman: number
): Promise<QuoteResult> {
  const route = getRoute(fromId, toId);
  if (!route) throw new Error(`No route for ${fromId} → ${toId}`);

  const fromToken = SWAP_TOKENS.find((t) => t.id === fromId)!;
  const toToken = SWAP_TOKENS.find((t) => t.id === toId)!;
  const amountInRaw = Number(toRawAmount(amountInHuman, fromToken.decimals));

  // A tiny reference trade (the contract minimum) approximates the spot
  // rate, so we can show how much the user's size moves the price. Fetched
  // in parallel with the real quote.
  const refInRaw = Number(MIN_SWAP_RAW[fromId] ?? 0n);
  const [amountOutRaw, refOutRaw] = await Promise.all([
    quoteRawOut(fromId, toId, amountInRaw),
    refInRaw > 0 && refInRaw < amountInRaw
      ? quoteRawOut(fromId, toId, refInRaw).catch(() => 0)
      : Promise.resolve(0),
  ]);

  return {
    amountOut: amountOutRaw,
    amountOutHuman: amountOutRaw / Math.pow(10, toToken.decimals),
    route,
    quotedAt: Date.now(),
    priceImpact: computePriceImpact(
      refInRaw,
      refOutRaw,
      amountInRaw,
      amountOutRaw
    ),
  };
}
```

- [ ] **Step 2: Replace `src/lib/direct-swap.ts` with the final barrel**

The entire file now reads:

```ts
// src/lib/direct-swap.ts
// Barrel — public API for the swap module. Consumers import from
// "@/lib/direct-swap"; the implementation lives under domain/, infra/, app/.
// See docs/superpowers/specs/2026-05-23-direct-swap-domain-extraction-design.md

export type { SwapToken } from "./domain/swap/tokens";
export {
  SWAP_TOKENS,
  SWAP_TOKEN_USD,
  SWAP_PRICE_GECKO_IDS,
} from "./domain/swap/tokens";

export type { SwapRoute } from "./domain/swap/routes";
export {
  getRoute,
  getValidDestinations,
  getSwappableFromTokens,
} from "./domain/swap/routes";

export {
  STX_GAS_RESERVE,
  toRawAmount,
  applySlippageFloor,
  sanitizeAmountInput,
  amountForPercent,
  exceedsBalance,
} from "./domain/swap/amount";

export {
  MIN_STX_FOR_FEE,
  minSwapHuman,
  isBelowMinSwap,
  lacksStxForFee,
  slippageWarning,
} from "./domain/swap/limits";

export type { QuoteResult } from "./domain/swap/quote-math";
export {
  quoteRate,
  computePriceImpact,
  QUOTE_TTL_MS,
  isQuoteStale,
  quoteSecondsLeft,
} from "./domain/swap/quote-math";

export { resolveUnitUsd, formatUsd } from "./domain/swap/usd";

export type { SwapParams } from "./domain/swap/clarity";
export { buildSwapParams } from "./domain/swap/clarity";

export { getQuote } from "./app/swap/quote";
```

- [ ] **Step 3: Verify green**

```bash
npm test -- src/lib/direct-swap.test.ts
npm run build
```
Expected: All tests pass. Build succeeds. The 4 external consumers (`SwapWidget`, `SwapPairChart`, `useMarketData`, `market-snapshot`) compile through the barrel without edits.

- [ ] **Step 4: Sanity check — confirm direct-swap.ts is now barrel-only**

```bash
wc -l src/lib/direct-swap.ts
```
Expected: under 60 lines.

```bash
grep -E "function |async function" src/lib/direct-swap.ts
```
Expected: no output (no function definitions left in the barrel).

- [ ] **Step 5: Run the full test suite once to be safe**

```bash
npm test
```
Expected: All tests pass. Pay special attention to `direct-swap.test.ts`, `contract-info.test.ts`, `protocol-positions.test.ts`, and any other test that might import from `@/lib/direct-swap` transitively.

- [ ] **Step 6: Commit**

```bash
git add src/lib/app/swap/quote.ts src/lib/direct-swap.ts
git commit -m "refactor(direct-swap): move getQuote orchestrator to app/swap; barrel-only direct-swap.ts"
```

---

## Done

After Task 6, the pilot is complete:

- `src/lib/direct-swap.ts` is a barrel of re-exports (~50 LOC).
- `src/lib/domain/swap/` holds 8 pure files (no I/O).
- `src/lib/infra/stacks/read-only.ts` is the single Hiro adapter.
- `src/lib/app/swap/quote.ts` is the orchestrator.
- The 4 external consumers and the characterization test file did not change.
- `npm test` and `npm run build` are green at every commit.

The pattern (domain/infra/app + barrel) is now validated for future application to `dca.ts`, `dca-sbtc.ts`, and `stacks.ts` in later sessions.
