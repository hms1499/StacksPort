> # ⛔ ABANDONED 2026-05-18 — DO NOT EXECUTE
> Option 1 was shelved by owner decision. The only Bitflow API the project has
> (staging test gateway) returns HTTP 404 (`/getAllTokensAndPools` down), and
> there is no production host — so the aggregator path is unexecutable, not just
> unsafe for prod. Execution halted at Task 2 (token-id discovery).
> **Final state for the mini project:** the data-driven `ROUTE_TABLE` engine
> (3 routes: STX↔sBTC, sBTC→USDCx) is the shipped & only swap engine. The 3
> missing USDCx/STX pairs are intentionally not delivered. The discovery probe
> (`scripts/bitflow-probe.mjs`, commit fb6ad48) is kept so this can be revived
> if/when a working Bitflow host exists — resume from Task 2.

# SwapWidget → Bitflow Aggregator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the Trade-tab SwapWidget from the hand-rolled 3-route `ROUTE_TABLE` to the Bitflow SDK aggregator already wired in the repo, unlocking all token pairs (incl. the 3 missing USDCx/STX multi-hop directions) without writing a new Clarity contract.

**Architecture:** SwapWidget keeps its UX/validation helpers (`toRawAmount`, `applySlippageFloor`, `isBelowMinSwap`, `sanitizeAmountInput`, `isQuoteStale`, request-id race guard). The *quote source* and *swap-param builder* move behind a thin client (`bitflow-client.ts`) that calls the existing `/api/bitflow/quote` and `/api/bitflow/swap-params` routes (server-side `BitflowSDK`). A pure adapter maps the SDK's `QuoteResult` into the existing `QuoteResult` shape so the render layer barely changes. A feature flag (`NEXT_PUBLIC_SWAP_ENGINE`) lets us ship dark, compare, and roll back instantly. `ROUTE_TABLE` stays as the fallback engine.

**Tech Stack:** Next.js 15 App Router, `@bitflowlabs/core-sdk` (server-only), Vitest, `@stacks/connect` `openContractCall`, `@stacks/transactions` post-conditions.

---

## Execution decision (2026-05-18) — TEST-GATEWAY, DEV-ONLY

The project has **no Bitflow production host** — only the `…-test-…` staging gateway already defaulted in `bitflow-server.ts`. Path A chosen:

- Build & verify the full integration against the test gateway.
- **Task 8's "flip default" is REMOVED.** Production stays on `routetable` (the safe 3-route engine). `NEXT_PUBLIC_SWAP_ENGINE=bitflow` is dev/preview only.
- No production credentials required from the user. Task 1 is reduced to "confirm test gateway reachable + make the probe fall back to the same defaults as `bitflow-server.ts`".
- When a production Bitflow host exists later, going live is a one-line env change (`NEXT_PUBLIC_SWAP_ENGINE=bitflow` + prod `BITFLOW_API_HOST`), plus re-running the Task 5 parity gate against prod.

---

## Pre-flight facts (verified 2026-05-18, do not re-derive)

- `bitflow-sbtc-swap-router` exposes only `swap-stx-for-token`; `bitflow-usdcx-swap-router` only `swap-sbtc-for-token`. Hardcoded routers are single-direction → the 3 missing routes are unreachable via `ROUTE_TABLE`. This is why we move to the aggregator.
- SDK surface (`node_modules/@bitflowlabs/core-sdk/dist/src`):
  - `getQuoteForRoute(tokenX: string, tokenY: string, amountInput: number): Promise<QuoteResult>`
  - `prepareSwap(swapExecutionData: SwapExecutionData, senderAddress: string, slippageTolerance?: number): Promise<SwapDataParamsAndPostConditions>`
  - `getAvailableTokens(): Promise<Token[]>`
- `QuoteResult = { bestRoute: RouteQuote | null; allRoutes: RouteQuote[]; inputData: {...} }`
- `RouteQuote = { route: SelectedSwapRoute; quote: number | null; dexPath: string[]; tokenPath: string[]; tokenXDecimals: number; tokenYDecimals: number; error?: string }`
- `SwapExecutionData = { route: SelectedSwapRoute; amount: number; tokenXDecimals: number; tokenYDecimals: number }`
- `SwapDataParamsAndPostConditions = { functionArgs: any[]; postConditions: any[]; contractAddress: string; contractName: string; functionName: string }` — directly feedable to `openContractCall`.
- Existing routes already handle the bigint JSON transport: `/api/bitflow/quote` (GET `from,to,amount`), `/api/bitflow/swap-params` (POST `{swapExecutionData, senderAddress, slippage}`), `/api/bitflow/tokens` (GET).
- ⚠️ `src/lib/bitflow-server.ts` defaults to a `…-test-…` gateway host. Production host/key must be confirmed (Task 1).
- `tokenX/tokenY` for `getQuoteForRoute` are **Bitflow token-id strings**, not our `SWAP_TOKENS.id`. The real ids are discovered, not guessed (Task 2).

---

## File Structure

- **Create** `src/lib/bitflow-tokens.ts` — pure map: our `SWAP_TOKENS.id` ↔ Bitflow `token-id`. One responsibility: identity translation.
- **Create** `src/lib/bitflow-tokens.test.ts` — unit tests for the map + helpers.
- **Create** `src/lib/bitflow-client.ts` — browser-side fetch wrappers for `/api/bitflow/quote` and `/api/bitflow/swap-params` (incl. `__bigint` revival) + pure adapter `toQuoteResult()`.
- **Create** `src/lib/bitflow-client.test.ts` — unit tests for the pure adapter (no network; SDK payloads are fixtures captured by a discovery script).
- **Create** `scripts/bitflow-probe.mjs` — one-off discovery/characterization script: prints real `getAvailableTokens`, `getQuoteForRoute`, and `prepareSwap` output for the 3 existing routes. Output is pasted into tasks/fixtures so nothing is guessed.
- **Modify** `src/components/trade/SwapWidget.tsx` — behind `NEXT_PUBLIC_SWAP_ENGINE`, source quotes/exec from `bitflow-client` instead of `direct-swap`. Keep all validation helpers.
- **Modify** `src/lib/direct-swap.ts` — no logic change; only export a shared `SwapEngine`-agnostic `QuoteResult` type if needed (Task 5 confirms).
- **Modify** `.env.local` (dev) / Vercel env — `BITFLOW_API_HOST`, `BITFLOW_API_KEY`, `READONLY_CALL_API_HOST`, `NEXT_PUBLIC_SWAP_ENGINE`.
- **Modify** `CLAUDE.md` — document the engine flag + that the aggregator is now primary.

Each task below is independently committable and leaves the app green (flag defaults to `routetable`, so behaviour is unchanged until Task 8 flips it).

---

## Task 1: Confirm test gateway reachable (dev-only, no prod creds)

**Files:**
- Reference: `src/lib/bitflow-server.ts:5-20`

Per the Execution decision: no production env. Confirm the staging defaults are present and that the probe will reuse them.

- [ ] **Step 1: Read current host defaults**

Run: `grep -nE "API_HOST|API_KEY|gateway" src/lib/bitflow-server.ts`
Expected: defaults contain `…-test-…` gateway URLs (`BITFLOW_API_HOST` default `https://bitflowsdk-api-test-7owjsmt8.uk.gateway.dev`, `READONLY_CALL_API_HOST` default `https://node.bitflowapis.finance`).

- [ ] **Step 2: Record defaults for the probe**

The probe script (Task 2) must fall back to these exact defaults when env vars are unset, so it works with zero credentials. No `.env.local` changes and no secrets are required for dev-only execution.

- [ ] **Step 3: Commit (no-op marker so the task is tracked)**

```bash
git commit -m "chore(trade): Task1 — dev-only against Bitflow test gateway (no prod env)" --allow-empty
```

---

## Task 2: Discover & lock the Bitflow token-id map

**Files:**
- Create: `scripts/bitflow-probe.mjs`
- Create: `src/lib/bitflow-tokens.ts`
- Create: `src/lib/bitflow-tokens.test.ts`

- [ ] **Step 1: Write the discovery script**

Create `scripts/bitflow-probe.mjs`:
```js
// Run: node scripts/bitflow-probe.mjs
// Prints real Bitflow data so the plan uses verified ids, not guesses.
import { BitflowSDK } from "@bitflowlabs/core-sdk";

const bitflow = new BitflowSDK({
  BITFLOW_API_HOST: process.env.BITFLOW_API_HOST,
  BITFLOW_API_KEY: process.env.BITFLOW_API_KEY,
  READONLY_CALL_API_HOST: process.env.READONLY_CALL_API_HOST,
  BITFLOW_PROVIDER_ADDRESS: process.env.BITFLOW_PROVIDER_ADDRESS,
});

const tokens = await bitflow.getAvailableTokens();
console.log("=== TOKENS ===");
for (const t of tokens) {
  console.log(`${t.symbol}\t${t["token-id"]}\t${t.tokenContract}\t${t.tokenDecimals}`);
}
```

- [ ] **Step 2: Run it with prod env and record output**

Run: `set -a; source .env.local; set +a; node scripts/bitflow-probe.mjs`
Expected: a token table. **Record** the exact `token-id` for STX, sBTC, USDCx (these become the constants in Step 3). If USDCx is not listed, STOP — the aggregator does not support it and Option 1 is void; report back.

- [ ] **Step 3: Write the failing test**

Create `src/lib/bitflow-tokens.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toBitflowId, fromBitflowId } from "./bitflow-tokens";

describe("bitflow token id mapping", () => {
  it("maps our SWAP_TOKENS ids to verified Bitflow token-ids", () => {
    expect(toBitflowId("stx")).toBe(STX_BITFLOW_ID);   // from Step 2
    expect(toBitflowId("sbtc")).toBe(SBTC_BITFLOW_ID);
    expect(toBitflowId("usdcx")).toBe(USDCX_BITFLOW_ID);
  });
  it("round-trips", () => {
    expect(fromBitflowId(toBitflowId("sbtc"))).toBe("sbtc");
  });
  it("throws on an unknown id", () => {
    expect(() => toBitflowId("doge")).toThrow();
  });
});
```
Replace `STX_BITFLOW_ID` / `SBTC_BITFLOW_ID` / `USDCX_BITFLOW_ID` with the literal strings recorded in Step 2 before running.

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/lib/bitflow-tokens.test.ts`
Expected: FAIL — `toBitflowId is not a function`.

- [ ] **Step 5: Write minimal implementation**

Create `src/lib/bitflow-tokens.ts` (fill the three values from Step 2):
```ts
// Verified against bitflow.getAvailableTokens() on 2026-05-18 (Task 2 Step 2).
const ID_TO_BITFLOW: Record<string, string> = {
  stx: "<STX token-id>",
  sbtc: "<sBTC token-id>",
  usdcx: "<USDCx token-id>",
};
const BITFLOW_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(ID_TO_BITFLOW).map(([k, v]) => [v, k])
);

export function toBitflowId(ourId: string): string {
  const v = ID_TO_BITFLOW[ourId];
  if (!v) throw new Error(`No Bitflow token-id for "${ourId}"`);
  return v;
}
export function fromBitflowId(bitflowId: string): string {
  const v = BITFLOW_TO_ID[bitflowId];
  if (!v) throw new Error(`No SWAP_TOKENS id for "${bitflowId}"`);
  return v;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/bitflow-tokens.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/bitflow-probe.mjs src/lib/bitflow-tokens.ts src/lib/bitflow-tokens.test.ts
git commit -m "feat(trade): verified Bitflow token-id map + discovery probe"
```

---

## Task 3: Pure adapter — Bitflow QuoteResult → app QuoteResult

**Files:**
- Modify: `src/lib/bitflow-client.ts` (create with adapter only this task)
- Create: `src/lib/bitflow-client.test.ts`

The app's render layer expects `QuoteResult { amountOut, amountOutHuman, route:{hops}, quotedAt, priceImpact }` (from `direct-swap.ts`). The adapter converts a Bitflow `QuoteResult` to this shape. Price impact: derive from `bestRoute.quote` vs the best of `allRoutes` is not spot — instead reuse existing `computePriceImpact` with a small reference is not available here, so set `priceImpact: 0` when undeterminable (documented; do not fabricate a number).

- [ ] **Step 1: Capture a real SDK quote fixture**

Append to `scripts/bitflow-probe.mjs`:
```js
const q = await bitflow.getQuoteForRoute(process.argv[2], process.argv[3], Number(process.argv[4]));
console.log("=== QUOTE ===");
console.log(JSON.stringify(q, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
```
Run: `set -a; source .env.local; set +a; node scripts/bitflow-probe.mjs <stx-id> <sbtc-id> 5`
Save the printed JSON as the fixture used in Step 2 (`bestRoute`, `dexPath`, `tokenPath`, `tokenYDecimals`, `quote`).

- [ ] **Step 2: Write the failing test**

Create `src/lib/bitflow-client.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toQuoteResult } from "./bitflow-client";

// Trimmed real payload from Task 3 Step 1 (paste actual numbers/strings).
const SDK_QUOTE = {
  bestRoute: {
    quote: <real quote number>,
    dexPath: <real dexPath array>,
    tokenPath: <real tokenPath array>,
    tokenYDecimals: <real number>,
    route: { /* opaque; passed through */ },
  },
  allRoutes: [],
  inputData: { tokenX: "<stx-id>", tokenY: "<sbtc-id>", amountInput: 5 },
} as any;

describe("toQuoteResult", () => {
  it("maps a Bitflow quote to the app QuoteResult shape", () => {
    const before = Date.now();
    const r = toQuoteResult(SDK_QUOTE);
    expect(r.amountOutHuman).toBe(<real quote number>);
    expect(r.amountOut).toBe(
      Math.round(<real quote number> * 10 ** <real tokenYDecimals>)
    );
    expect(r.route.hops.length).toBeGreaterThan(0);
    expect(r.quotedAt).toBeGreaterThanOrEqual(before);
    expect(r.priceImpact).toBe(0);
  });

  it("throws when there is no viable route", () => {
    expect(() =>
      toQuoteResult({ bestRoute: null, allRoutes: [], inputData: {} } as any)
    ).toThrow(/no route/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/bitflow-client.test.ts`
Expected: FAIL — `toQuoteResult is not a function`.

- [ ] **Step 4: Write minimal implementation**

Create `src/lib/bitflow-client.ts`:
```ts
import type { QuoteResult as AppQuoteResult, SwapRoute } from "./direct-swap";

// Minimal shape we read from the Bitflow SDK QuoteResult (server-serialized).
interface BitflowQuote {
  bestRoute: {
    quote: number | null;
    dexPath: string[];
    tokenPath: string[];
    tokenYDecimals: number;
    route: unknown;
  } | null;
  allRoutes: unknown[];
  inputData: { tokenX: string; tokenY: string; amountInput: number };
}

export function toQuoteResult(q: BitflowQuote): AppQuoteResult {
  const b = q.bestRoute;
  if (!b || b.quote == null) {
    throw new Error("Bitflow returned no route for this pair");
  }
  const route: SwapRoute = {
    from: q.inputData.tokenX,
    to: q.inputData.tokenY,
    method: "router",
    hops: b.tokenPath,
  };
  return {
    amountOut: Math.round(b.quote * 10 ** b.tokenYDecimals),
    amountOutHuman: b.quote,
    route,
    quotedAt: Date.now(),
    priceImpact: 0, // aggregator does not return a spot reference; not fabricated
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/bitflow-client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/bitflow-client.ts src/lib/bitflow-client.test.ts scripts/bitflow-probe.mjs
git commit -m "feat(trade): pure adapter Bitflow quote -> app QuoteResult"
```

---

## Task 4: Browser client for the existing API routes

**Files:**
- Modify: `src/lib/bitflow-client.ts`
- Modify: `src/lib/bitflow-client.test.ts`

- [ ] **Step 1: Write the failing test (bigint revival is pure)**

Append to `src/lib/bitflow-client.test.ts`:
```ts
import { reviveBigInts } from "./bitflow-client";

describe("reviveBigInts", () => {
  it("restores { __bigint } placeholders deeply", () => {
    const input = { a: { __bigint: "42" }, b: [{ __bigint: "7" }], c: 1 };
    expect(reviveBigInts(input)).toEqual({ a: 42n, b: [7n], c: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bitflow-client.test.ts`
Expected: FAIL — `reviveBigInts is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/bitflow-client.ts`:
```ts
export function reviveBigInts(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if ("__bigint" in (obj as object)) {
    return BigInt((obj as { __bigint: string }).__bigint);
  }
  if (Array.isArray(obj)) return obj.map(reviveBigInts);
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k,
      reviveBigInts(v),
    ])
  );
}

export async function fetchBitflowQuote(
  fromBitflowId: string,
  toBitflowId: string,
  amountHuman: number
) {
  const u = new URL("/api/bitflow/quote", window.location.origin);
  u.searchParams.set("from", fromBitflowId);
  u.searchParams.set("to", toBitflowId);
  u.searchParams.set("amount", String(amountHuman));
  const res = await fetch(u, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error("Quote request failed");
  return reviveBigInts(await res.json()) as Parameters<typeof toQuoteResult>[0];
}

export async function fetchBitflowSwapParams(
  swapExecutionData: unknown,
  senderAddress: string,
  slippage: number
) {
  const res = await fetch("/api/bitflow/swap-params", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ swapExecutionData, senderAddress, slippage }),
  });
  if (!res.ok) throw new Error("Swap-params request failed");
  return reviveBigInts(await res.json()) as {
    contractAddress: string;
    contractName: string;
    functionName: string;
    functionArgs: unknown[];
    postConditions: unknown[];
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bitflow-client.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bitflow-client.ts src/lib/bitflow-client.test.ts
git commit -m "feat(trade): browser client for Bitflow quote/swap-params routes"
```

---

## Task 5: Characterize the 3 existing routes (old vs aggregator)

**Files:**
- Modify: `scripts/bitflow-probe.mjs`
- Create: `docs/superpowers/plans/bitflow-parity-2026-05-18.md` (evidence log)

This is a **safety gate**, not code. It proves the aggregator returns sane output for STX→sBTC, sBTC→STX, sBTC→USDCx before we trust it for new pairs.

- [ ] **Step 1: Extend probe to print prepareSwap**

Append to `scripts/bitflow-probe.mjs`:
```js
if (process.argv[5] === "prepare") {
  const sed = {
    route: q.bestRoute.route,
    amount: Number(process.argv[4]),
    tokenXDecimals: q.bestRoute.tokenXDecimals,
    tokenYDecimals: q.bestRoute.tokenYDecimals,
  };
  const p = await bitflow.prepareSwap(sed, process.argv[6], 0.5);
  console.log("=== PREPARE ===");
  console.log(JSON.stringify(p, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
}
```

- [ ] **Step 2: Run for all 3 existing routes**

Run (substitute real token-ids + a real sender address):
```
set -a; source .env.local; set +a
node scripts/bitflow-probe.mjs <stx> <sbtc> 5 prepare <SENDER>
node scripts/bitflow-probe.mjs <sbtc> <stx> 0.001 prepare <SENDER>
node scripts/bitflow-probe.mjs <sbtc> <usdcx> 0.01 prepare <SENDER>
```
Expected: each prints a `PREPARE` block with `contractAddress/Name/functionName/functionArgs/postConditions`.

- [ ] **Step 3: Record evidence + assert post-condition safety**

In `docs/superpowers/plans/bitflow-parity-2026-05-18.md`, paste each PREPARE block and answer explicitly:
- Does `postConditions` contain a restrictive sender-spend condition (the user cannot send more than input)?
- Is post-condition **mode** Deny? (If `prepareSwap` output omits mode, the call site must set `PostConditionMode.Deny` — note this for Task 6.)

If any route returns empty/permissive post-conditions, STOP: Task 6 must wrap with our own `senderSpendPostCondition` + Deny (reuse from `direct-swap.ts`). Do not proceed to flip the flag until this is resolved.

- [ ] **Step 4: Commit the evidence**

```bash
git add docs/superpowers/plans/bitflow-parity-2026-05-18.md scripts/bitflow-probe.mjs
git commit -m "docs(trade): Bitflow aggregator parity evidence for 3 existing routes"
```

---

## Task 6: Wire SwapWidget behind the engine flag (quote path)

**Files:**
- Modify: `src/components/trade/SwapWidget.tsx`
- Reference: `src/lib/bitflow-client.ts`, `src/lib/bitflow-tokens.ts`

The flag default is `routetable` so behaviour is unchanged. The Bitflow branch only activates when `NEXT_PUBLIC_SWAP_ENGINE=bitflow`.

- [ ] **Step 1: Add the engine switch to the quote fetcher**

In `src/components/trade/SwapWidget.tsx`, inside `fetchQuote` (the `useCallback`), replace the single `getQuote(...)` call with:
```ts
const engine = process.env.NEXT_PUBLIC_SWAP_ENGINE ?? "routetable";
const result =
  engine === "bitflow"
    ? toQuoteResult(
        await fetchBitflowQuote(
          toBitflowId(from.id),
          toBitflowId(to.id),
          amt
        )
      )
    : await getQuote(from.id, to.id, amt);
```
Add imports at the top:
```ts
import { fetchBitflowQuote, toQuoteResult } from "@/lib/bitflow-client";
import { toBitflowId } from "@/lib/bitflow-tokens";
```
Keep the existing `quoteReqId` race guard and `setQuote(result)/setStatus("ready")` exactly as-is — `toQuoteResult` returns the same `QuoteResult` shape, so no render changes.

- [ ] **Step 2: Typecheck + lint + unit suite**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/trade/SwapWidget.tsx && npx vitest run`
Expected: no errors; 39+ tests pass (flag defaults to routetable → unchanged).

- [ ] **Step 3: Manual smoke (flag on)**

Run: `NEXT_PUBLIC_SWAP_ENGINE=bitflow npm run dev`, open `/trade`, request a STX→sBTC quote. Expected: a quote renders; numbers within ~1% of the `routetable` engine for the same amount (compare by toggling the env). Kill port 3000 when done.

- [ ] **Step 4: Commit**

```bash
git add src/components/trade/SwapWidget.tsx
git commit -m "feat(trade): quote via Bitflow aggregator behind NEXT_PUBLIC_SWAP_ENGINE"
```

---

## Task 7: Wire swap execution via prepareSwap

**Files:**
- Modify: `src/components/trade/SwapWidget.tsx`
- Reference: Task 5 evidence doc (post-condition decision)

- [ ] **Step 1: Branch handleSwap on the engine flag**

In `handleSwap`, after the existing stale/min-swap guards, replace the `buildSwapParams(...)` block with:
```ts
const engine = process.env.NEXT_PUBLIC_SWAP_ENGINE ?? "routetable";
let call: {
  contractAddress: string; contractName: string; functionName: string;
  functionArgs: unknown[]; postConditions: unknown[];
};
if (engine === "bitflow") {
  // quote.route carries the Bitflow SelectedSwapRoute via the adapter;
  // see Task 5 for whether we trust SDK post-conditions or wrap our own.
  const sed = bitflowSwapExecutionData(quote, amountIn);
  call = await fetchBitflowSwapParams(sed, stxAddress, slippage);
} else {
  const minOut = applySlippageFloor(BigInt(Math.floor(quote.amountOut)), slippage);
  call = buildSwapParams(fromToken.id, toToken.id, amountIn, minOut, stxAddress);
}
openContractCall({
  contractAddress: call.contractAddress,
  contractName: call.contractName,
  functionName: call.functionName,
  functionArgs: call.functionArgs as never[],
  postConditions: call.postConditions as never[],
  postConditionMode: PostConditionMode.Deny, // enforce regardless of SDK default (Task 5)
  network,
  onFinish: ({ txId: id }) => { /* unchanged */ },
  onCancel: () => setStatus("ready"),
});
```

- [ ] **Step 2: Carry the SDK route on the quote**

The adapter currently drops `bestRoute.route`. Extend `toQuoteResult` to attach it, and add `bitflowSwapExecutionData`:

In `src/lib/bitflow-client.ts`, add to the returned object: `bitflowRoute: b.route, bitflowYDecimals: b.tokenYDecimals, bitflowXDecimals: <add tokenXDecimals to BitflowQuote interface>` (extend the `BitflowQuote.bestRoute` interface to include `tokenXDecimals: number`). Then:
```ts
export function bitflowSwapExecutionData(q: AppQuoteResult & {
  bitflowRoute: unknown; bitflowXDecimals: number; bitflowYDecimals: number;
}, amountInHuman: string) {
  return {
    route: q.bitflowRoute,
    amount: Number(amountInHuman),
    tokenXDecimals: q.bitflowXDecimals,
    tokenYDecimals: q.bitflowYDecimals,
  };
}
```
Update `direct-swap.ts` `QuoteResult` is NOT changed; instead the bitflow extras live on the object returned by `toQuoteResult` via an intersection type exported from `bitflow-client.ts`. Update Task 3 test to assert the extra fields are present.

- [ ] **Step 3: Typecheck + unit suite**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run`
Expected: green; bitflow-client tests updated for the extra fields pass.

- [ ] **Step 4: Manual swap on a real wallet (testnet-sized amount)**

`NEXT_PUBLIC_SWAP_ENGINE=bitflow npm run dev` → connect wallet → swap a *minimum* sBTC→USDCx. In the wallet popup, confirm: correct contract, and a post-condition that caps what you send. Cancel if anything looks off. Kill port 3000 after.

- [ ] **Step 5: Commit**

```bash
git add src/components/trade/SwapWidget.tsx src/lib/bitflow-client.ts src/lib/bitflow-client.test.ts
git commit -m "feat(trade): execute swaps via Bitflow prepareSwap behind engine flag"
```

---

## Task 8: Validation pass (dev-only — default stays routetable)

**Files:**
- Reference: `src/components/trade/SwapWidget.tsx`

Per the Execution decision, the production default is **not** flipped. This task only validates the aggregator works behind the flag in dev.

- [ ] **Step 1: Verify all 6 directions in dev**

`NEXT_PUBLIC_SWAP_ENGINE=bitflow npm run dev`. Manually quote each: STX→sBTC, sBTC→STX, sBTC→USDCx (parity vs old), and the 3 new: USDCx→sBTC, STX→USDCx, USDCx→STX. Record pass/fail in the parity doc. Kill port 3000 after.

- [ ] **Step 2: Confirm helpers still apply**

In the UI: min-swap block, slippage warning, sanitized input, stale-quote refetch, request-id race guard all still behave (they wrap the engine, not replaced). `priceImpact` shows 0 on the bitflow engine (documented limitation) — confirm the row hides cleanly when 0 (`quote.priceImpact > 0` already guards it).

- [ ] **Step 3: Confirm default is unchanged**

Run: `grep -n 'NEXT_PUBLIC_SWAP_ENGINE ?? "routetable"' src/components/trade/SwapWidget.tsx`
Expected: every call site still defaults to `"routetable"`. Production behaviour is unchanged. Do NOT change Vercel env.

- [ ] **Step 4: Full build + suite**

Run: `npm run build && npx vitest run`
Expected: `✓ Compiled successfully`; all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git commit -m "test(trade): validate Bitflow engine behind flag (default stays routetable)" --allow-empty
```

---

## Task 9: Docs + cleanup

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to the "Adding a Swap Pair (ROUTE_TABLE)" section: there is a second, opt-in engine — the Bitflow aggregator — selectable via `NEXT_PUBLIC_SWAP_ENGINE=bitflow` (dev/preview only; **production stays `routetable`** until a Bitflow production host exists). Document both `NEXT_PUBLIC_SWAP_ENGINE` values, that the test gateway is staging-only, and that flipping prod requires a prod host + re-running the Task 5 parity gate.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: Bitflow aggregator is primary swap engine; engine flag"
```

---

## Self-Review

**Spec coverage:** Option 1 = route SwapWidget through the existing Bitflow SDK aggregator → Tasks 3–8. Unlock 3 missing pairs → verified in Task 8 Step 1. Don't break existing 3 → Task 5 parity gate + flag default `routetable` until Task 8. Production host risk → Task 1 (hard stop). Token-id guessing risk → Task 2 (discovery, not guess). Post-condition safety regression → Task 5 Step 3 + Task 7 Step 1 (`PostConditionMode.Deny` enforced at call site).

**Placeholder scan:** Network-shaped values (token-ids, quote numbers, prepareSwap output) are intentionally filled by explicit discovery scripts with exact commands (Tasks 2/3/5) rather than guessed — this is the honest substitute for hardcoding unknowns, not a placeholder. All pure code is fully written.

**Type consistency:** `toQuoteResult` returns `direct-swap.ts`'s `QuoteResult`; bitflow extras are an intersection exported from `bitflow-client.ts` (Task 7 Step 2), keeping `direct-swap.ts` untouched. `fetchBitflowSwapParams` return shape matches the fields fed to `openContractCall` in Task 7. `toBitflowId` used in Task 6 is defined in Task 2.

**Open risk to flag at execution:** if Task 2 Step 2 shows USDCx absent from Bitflow's token list, Option 1 cannot deliver USDCx routes — escalate before continuing.
```
