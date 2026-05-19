# Đợt 1 — Swap / Trade Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix misleading Trade-tab copy (#4), warn when STX is too low for the swap fee (#2), and make the balance gate use exact BigInt math (#3).

**Architecture:** Two pure helpers + one constant are added to `src/lib/direct-swap.ts` (unit-tested with Vitest), then wired into `SwapWidget.tsx`. The copy fix is a content-only edit to `src/app/trade/page.tsx`. No new dependencies, no plumbing refactor — balance fetch still returns a human number.

**Tech Stack:** TypeScript, Next.js 15, Vitest 2, `@stacks/transactions`.

Spec: `docs/superpowers/specs/2026-05-19-swap-trade-batch1-design.md`

---

## File Structure

- `src/lib/direct-swap.ts` — add `MIN_STX_FOR_FEE`, `exceedsBalance`, `lacksStxForFee`. Pure money/guard logic; same home as `toRawAmount`/`isBelowMinSwap`.
- `src/lib/direct-swap.test.ts` — append two new `describe` blocks; do not touch the characterization tests.
- `src/components/trade/SwapWidget.tsx` — replace 3 float balance comparisons; add `stxBalance` state + effect + yellow fee warning.
- `src/app/trade/page.tsx` — fix 1 panel title, 1 panel body, 1 tip string.

Commit boundaries (each green): (1) helpers+tests, (2) #3 wiring, (3) #2 wiring, (4) #4 copy.

---

### Task 1: Helpers `exceedsBalance` + `lacksStxForFee` + `MIN_STX_FOR_FEE`

**Files:**
- Modify: `src/lib/direct-swap.ts`
- Test: `src/lib/direct-swap.test.ts`

- [ ] **Step 1: Add the new symbols to the test import block**

In `src/lib/direct-swap.test.ts`, the import from `"./direct-swap"` currently ends:

```ts
  sanitizeAmountInput,
  slippageWarning,
  quoteRate,
} from "./direct-swap";
```

Replace with:

```ts
  sanitizeAmountInput,
  slippageWarning,
  quoteRate,
  exceedsBalance,
  lacksStxForFee,
  MIN_STX_FOR_FEE,
} from "./direct-swap";
```

- [ ] **Step 2: Write the failing tests**

Append to the **end** of `src/lib/direct-swap.test.ts` (after the final closing `});` of the characterization suite):

```ts
describe("exceedsBalance", () => {
  it("equal to balance (8-dec sBTC edge) → false", () => {
    expect(exceedsBalance("0.00000334", 0.00000334, 8)).toBe(false);
  });

  it("one sat over balance → true", () => {
    expect(exceedsBalance("0.00000335", 0.00000334, 8)).toBe(true);
  });

  it("empty amount → false", () => {
    expect(exceedsBalance("", 5, 6)).toBe(false);
  });

  it("NaN amount → false", () => {
    expect(exceedsBalance("abc", 5, 6)).toBe(false);
  });

  it("float-lossy STX magnitude compares exactly", () => {
    // 90071992.54740993 * 1e6 loses precision as a float; raw BigInt does not.
    expect(exceedsBalance("90071992.547410", 90071992.547409, 6)).toBe(true);
    expect(exceedsBalance("90071992.547409", 90071992.547409, 6)).toBe(false);
  });
});

describe("lacksStxForFee", () => {
  it("source token is STX → always false", () => {
    expect(lacksStxForFee("stx", 0)).toBe(false);
  });

  it("non-STX source, zero STX → true", () => {
    expect(lacksStxForFee("sbtc", 0)).toBe(true);
  });

  it("non-STX source, STX at threshold → false", () => {
    expect(lacksStxForFee("sbtc", MIN_STX_FOR_FEE)).toBe(false);
  });

  it("non-STX source, STX just below threshold → true", () => {
    expect(lacksStxForFee("sbtc", MIN_STX_FOR_FEE - 0.001)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/direct-swap.test.ts -t "exceedsBalance|lacksStxForFee"`
Expected: FAIL — `exceedsBalance`, `lacksStxForFee`, `MIN_STX_FOR_FEE` are not exported.

- [ ] **Step 4: Implement the helpers**

In `src/lib/direct-swap.ts`, locate the end of the "Money Math" section — immediately after the `amountForPercent` function (it ends with `return parseFloat(val.toFixed(places)).toString();\n}`). Add directly below it:

```ts
/**
 * True when `amountIn` (a human decimal string) strictly exceeds
 * `balanceHuman`, compared in raw integer units so 8-decimal edges are exact
 * (plain `parseFloat` drifts for large/precise sBTC amounts). Caller must only
 * pass a known balance.
 */
export function exceedsBalance(
  amountIn: string,
  balanceHuman: number,
  decimals: number
): boolean {
  return toRawAmount(amountIn, decimals) > toRawAmount(balanceHuman, decimals);
}

/**
 * Approximate STX kept free to pay a single swap contract-call fee. Below
 * this, a non-STX swap will likely revert for lack of fee. Heuristic, not a
 * fee estimate — intentionally avoids an extra RPC.
 */
export const MIN_STX_FOR_FEE = 0.05;

/**
 * True when the user spends a non-STX token and their STX balance is too low
 * to likely cover the transaction fee. Always false when the source IS STX —
 * the MAX gas-reserve logic (see {@link STX_GAS_RESERVE}) handles that path.
 */
export function lacksStxForFee(
  fromId: string,
  stxBalanceHuman: number
): boolean {
  if (fromId === "stx") return false;
  return stxBalanceHuman < MIN_STX_FOR_FEE;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/direct-swap.test.ts`
Expected: PASS — all new tests green AND every existing characterization test still green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/direct-swap.ts src/lib/direct-swap.test.ts
git commit -m "feat(swap): add exceedsBalance + lacksStxForFee helpers"
```

---

### Task 2: Wire `exceedsBalance` into SwapWidget (#3)

**Files:**
- Modify: `src/components/trade/SwapWidget.tsx`

- [ ] **Step 1: Import the helper**

In `src/components/trade/SwapWidget.tsx`, the import block from `@/lib/direct-swap` lists helpers ending with `quoteRate,`. Add `exceedsBalance,` to that import list (alongside the existing named imports such as `applySlippageFloor`, `quoteRate`).

- [ ] **Step 2: Replace the input-field red-style comparison**

Find (around line 603):

```tsx
                isConnected && fromBalance !== null && parseFloat(amountIn) > fromBalance
```

Replace with:

```tsx
                isConnected && fromBalance !== null && exceedsBalance(amountIn, fromBalance, fromToken.decimals)
```

- [ ] **Step 3: Replace the "Insufficient balance" message guard**

Find (around lines 609-612):

```tsx
          {isConnected &&
            fromBalance !== null &&
            amountIn &&
            parseFloat(amountIn) > fromBalance && (
```

Replace with:

```tsx
          {isConnected &&
            fromBalance !== null &&
            amountIn &&
            exceedsBalance(amountIn, fromBalance, fromToken.decimals) && (
```

- [ ] **Step 4: Replace the Swap-button disabled guard**

Find (around line 817):

```tsx
          (fromBalance !== null && parseFloat(amountIn) > fromBalance)
```

Replace with:

```tsx
          (fromBalance !== null && exceedsBalance(amountIn, fromBalance, fromToken.decimals))
```

- [ ] **Step 5: Verify build + unit tests**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors.

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/trade/SwapWidget.tsx
git commit -m "fix(swap): use BigInt balance gate in SwapWidget"
```

---

### Task 3: STX-for-fee warning in SwapWidget (#2)

**Files:**
- Modify: `src/components/trade/SwapWidget.tsx`

- [ ] **Step 1: Import `lacksStxForFee`**

Add `lacksStxForFee,` to the existing `@/lib/direct-swap` import list in `src/components/trade/SwapWidget.tsx` (same block touched in Task 2).

- [ ] **Step 2: Add an STX-token module constant**

Find this module-scope line near the top of the file (after the imports / `type Status` line):

```tsx
const fromTokens = getSwappableFromTokens();
```

Add directly below it:

```tsx
const STX_TOKEN = fromTokens.find((t) => t.id === "stx")!;
```

- [ ] **Step 3: Add `stxBalance` state**

Find the existing balance state declarations:

```tsx
  const [fromBalance, setFromBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
```

Add directly below them:

```tsx
  const [stxBalance, setStxBalance] = useState<number | null>(null);
```

- [ ] **Step 4: Add the STX-balance effect**

Find the existing from-token balance effect. It ends with:

```tsx
    return () => { cancelled = true; };
  }, [fromToken, stxAddress, balanceNonce]);
```

Add directly below that closing line a new effect:

```tsx
  // STX balance for the fee-coverage warning. When the source IS STX we reuse
  // the already-fetched fromBalance instead of a second Hiro call.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!stxAddress) {
      setStxBalance(null);
      return;
    }
    if (fromToken.id === "stx") {
      setStxBalance(fromBalance);
      return;
    }
    let cancelled = false;
    fetchTokenBalance(stxAddress, STX_TOKEN)
      .then((b) => { if (!cancelled) setStxBalance(b); })
      .catch(() => { if (!cancelled) setStxBalance(null); });
    return () => { cancelled = true; };
  }, [fromToken.id, stxAddress, fromBalance, balanceNonce]);
```

- [ ] **Step 5: Render the yellow warning banner**

Find the "Wallet not connected" block:

```tsx
      {/* Wallet not connected */}
      {!isConnected && (
```

Insert this block immediately **before** that comment:

```tsx
      {/* Low STX for fee — non-STX source only; warn, do not block */}
      {isConnected &&
        stxBalance !== null &&
        !!amountIn &&
        lacksStxForFee(fromToken.id, stxBalance) && (
          <div
            className="flex items-start gap-2 text-xs rounded-xl px-3 py-2.5"
            style={{ backgroundColor: "rgba(234,179,8,0.10)", color: "rgb(234,179,8)" }}
          >
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>
              Low STX balance — you may not have enough STX to cover the
              transaction fee.
            </span>
          </div>
        )}

```

- [ ] **Step 6: Verify build + unit tests**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors (note: `AlertCircle` is already imported in this file).

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/trade/SwapWidget.tsx
git commit -m "feat(swap): warn when STX balance too low for fee"
```

---

### Task 4: Correct misleading Trade-tab copy (#4)

**Files:**
- Modify: `src/app/trade/page.tsx`

- [ ] **Step 1: Fix the "Best Routes" panel title**

Find:

```tsx
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Best Routes</h3>
```

Replace `Best Routes` with `On-chain Routing`:

```tsx
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>On-chain Routing</h3>
```

- [ ] **Step 2: Fix the panel body (false aggregation claim)**

Find:

```tsx
                  Aggregates multiple DEX pools to find the optimal swap path with lowest slippage.
```

Replace with:

```tsx
                  Routes swaps through Bitflow Pools using live on-chain quotes, with slippage protection enforced by the contract.
```

- [ ] **Step 3: Fix the false multi-hop tip (USDA/ALEX do not exist)**

Find:

```tsx
                "Multi-hop routes (e.g. STX → USDA → ALEX) often give better rates than direct pairs.",
```

Replace with:

```tsx
                "sBTC → USDCx routes automatically multi-hop through STX and aeUSDC — the path is fixed, you don't pick it.",
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds.

Also visually confirm on the Trade page that the "On-chain Routing" panel and updated tip render correctly (`npm run dev`, open http://localhost:3000/trade).

- [ ] **Step 5: Commit**

```bash
git add src/app/trade/page.tsx
git commit -m "docs(trade): correct misleading routing/aggregation copy"
```

---

## Self-Review

**Spec coverage:**
- #4 (false copy) → Task 4 (title, body, tip; "Real Yield" + 3 other tips untouched as the spec requires). ✓
- #2 (STX fee warning, soft, non-STX only, `stxBalance !== null` guard, yellow, no button block) → Task 3 + `lacksStxForFee`/`MIN_STX_FOR_FEE` in Task 1. ✓
- #3 (BigInt balance gate, 3 sites, no plumbing refactor) → Task 2 + `exceedsBalance` in Task 1. ✓
- Testing (exceedsBalance + lacksStxForFee cases incl. 8-dec edge, NaN, threshold) → Task 1 Step 2. ✓
- Commit plan (4 commits, each green, no Co-Authored-By) → one commit per task. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code and exact commands. ✓

**Type consistency:** `exceedsBalance(amountIn: string, balanceHuman: number, decimals: number)` and `lacksStxForFee(fromId: string, stxBalanceHuman: number)` and `MIN_STX_FOR_FEE: number` are used identically across Task 1 (def/tests), Task 2, and Task 3. `STX_TOKEN` defined once (Task 3 Step 2) before use (Step 4). ✓

No gaps found.
