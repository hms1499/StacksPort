# Bitflow → ALEX SDK Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead Bitflow SDK with ALEX SDK (`alex-sdk` v3.2.1) so the trade/swap tab works again.

**Architecture:** Swap out the server-side Bitflow singleton and 3 API routes with equivalent ALEX SDK calls. Update the SwapWidget to use ALEX types instead of Bitflow types. The ALEX SDK returns `TxToBroadCast` objects directly compatible with `openContractCall`.

**Tech Stack:** `alex-sdk`, `@stacks/connect`, `@stacks/transactions`, Next.js API routes

---

### Task 1: Install alex-sdk and remove @bitflowlabs/core-sdk

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install alex-sdk**

```bash
npm install alex-sdk
```

- [ ] **Step 2: Uninstall bitflow SDK**

```bash
npm uninstall @bitflowlabs/core-sdk
```

- [ ] **Step 3: Verify install succeeded**

```bash
npm ls alex-sdk
```

Expected: `alex-sdk@3.2.1`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: replace @bitflowlabs/core-sdk with alex-sdk"
```

---

### Task 2: Replace bitflow-server.ts with alex-server.ts

**Files:**
- Delete: `src/lib/bitflow-server.ts`
- Create: `src/lib/alex-server.ts`

- [ ] **Step 1: Create `src/lib/alex-server.ts`**

```typescript
import AlexSDK from "alex-sdk";

// Server-side singleton — no config needed, SDK uses public ALEX API
export const alex = new AlexSDK();
```

- [ ] **Step 2: Delete `src/lib/bitflow-server.ts`**

- [ ] **Step 3: Commit**

```bash
git add src/lib/alex-server.ts
git rm src/lib/bitflow-server.ts
git commit -m "feat: add alex-server singleton, remove bitflow-server"
```

---

### Task 3: Rewrite /api/bitflow/tokens → /api/alex/tokens

**Files:**
- Create: `src/app/api/alex/tokens/route.ts`
- Delete: `src/app/api/bitflow/tokens/route.ts`

The ALEX SDK's `fetchSwappableCurrency()` returns `TokenInfo[]` with fields: `id` (Currency), `name`, `icon`, `wrapToken`, `wrapTokenDecimals`, `underlyingToken`, `underlyingTokenDecimals`.

We also call `getLatestPrices()` to include price data, since the SwapWidget displays USD prices.

- [ ] **Step 1: Create `src/app/api/alex/tokens/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { alex } from "@/lib/alex-server";

export async function GET() {
  try {
    const [tokens, prices] = await Promise.all([
      alex.fetchSwappableCurrency(),
      alex.getLatestPrices(),
    ]);

    // Enrich tokens with price data for the frontend
    const enriched = tokens.map((t) => ({
      ...t,
      price: prices[t.id] ?? null,
    }));

    return NextResponse.json(enriched, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    console.error("[alex/tokens]", e);
    return NextResponse.json({ error: "Failed to fetch tokens" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Delete `src/app/api/bitflow/tokens/route.ts`**

- [ ] **Step 3: Verify endpoint works**

```bash
curl -s http://localhost:3000/api/alex/tokens | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Tokens: {len(d)}'); print(json.dumps(d[0], indent=2))"
```

Expected: A list of tokens with `id`, `name`, `icon`, and `price` fields.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/alex/tokens/route.ts
git rm src/app/api/bitflow/tokens/route.ts
git commit -m "feat: add /api/alex/tokens endpoint, remove bitflow tokens route"
```

---

### Task 4: Rewrite /api/bitflow/quote → /api/alex/quote

**Files:**
- Create: `src/app/api/alex/quote/route.ts`
- Delete: `src/app/api/bitflow/quote/route.ts`

ALEX SDK's `getAmountTo(from, fromAmount, to)` returns a `bigint` — the estimated output amount in 1e8 units. We also fetch all possible routes with details for display.

- [ ] **Step 1: Create `src/app/api/alex/quote/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { alex } from "@/lib/alex-server";
import { type Currency } from "alex-sdk";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from") as Currency | null;
  const to = searchParams.get("to") as Currency | null;
  const amount = Number(searchParams.get("amount") ?? "0");

  if (!from || !to || !amount) {
    return NextResponse.json({ error: "Missing params: from, to, amount" }, { status: 400 });
  }

  try {
    const fromAmount = BigInt(Math.round(amount * 1e8));

    const [amountTo, feeRate, route] = await Promise.all([
      alex.getAmountTo(from, fromAmount, to),
      alex.getFeeRate(from, to).catch(() => BigInt(0)),
      alex.getRoute(from, to).catch(() => null),
    ]);

    return NextResponse.json({
      amountTo: Number(amountTo) / 1e8,
      feeRate: Number(feeRate) / 1e8,
      route,
    });
  } catch (e) {
    console.error("[alex/quote]", e);
    return NextResponse.json({ error: "Failed to get quote" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Delete `src/app/api/bitflow/quote/route.ts`**

- [ ] **Step 3: Commit**

```bash
git add src/app/api/alex/quote/route.ts
git rm src/app/api/bitflow/quote/route.ts
git commit -m "feat: add /api/alex/quote endpoint, remove bitflow quote route"
```

---

### Task 5: Rewrite /api/bitflow/swap-params → /api/alex/swap

**Files:**
- Create: `src/app/api/alex/swap/route.ts`
- Delete: `src/app/api/bitflow/swap-params/route.ts`

ALEX SDK's `runSwap()` returns `TxToBroadCast` with `contractAddress`, `contractName`, `functionName`, `functionArgs`, `postConditions` — the same shape `openContractCall` expects. We serialize bigint values for JSON transport.

- [ ] **Step 1: Create `src/app/api/alex/swap/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { alex } from "@/lib/alex-server";
import { type Currency } from "alex-sdk";

function safeSerialize(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      typeof v === "bigint" ? { __bigint: v.toString() } : v
    )
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stxAddress, from, to, amount, slippage = 0.5 } = body as {
      stxAddress: string;
      from: Currency;
      to: Currency;
      amount: number;
      slippage?: number;
    };

    if (!stxAddress || !from || !to || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const fromAmount = BigInt(Math.round(amount * 1e8));

    // Calculate minDy from slippage percentage
    const amountTo = await alex.getAmountTo(from, fromAmount, to);
    const minDy = amountTo - (amountTo * BigInt(Math.round(slippage * 100))) / BigInt(10000);

    const tx = await alex.runSwap(stxAddress, from, to, fromAmount, minDy);

    return NextResponse.json(safeSerialize(tx));
  } catch (e) {
    console.error("[alex/swap]", e);
    return NextResponse.json({ error: "Failed to prepare swap" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Delete `src/app/api/bitflow/swap-params/route.ts`**

- [ ] **Step 3: Commit**

```bash
git add src/app/api/alex/swap/route.ts
git rm src/app/api/bitflow/swap-params/route.ts
git commit -m "feat: add /api/alex/swap endpoint, remove bitflow swap-params route"
```

---

### Task 6: Rewrite SwapWidget.tsx to use ALEX SDK types and endpoints

**Files:**
- Modify: `src/components/trade/SwapWidget.tsx`

This is the largest task. The SwapWidget needs to:
1. Remove all `@bitflowlabs/core-sdk` imports
2. Define a local `AlexToken` type matching the enriched response from `/api/alex/tokens`
3. Fetch tokens from `/api/alex/tokens` instead of `/api/bitflow/tokens`
4. Fetch quotes from `/api/alex/quote` instead of `/api/bitflow/quote`
5. Execute swaps via `/api/alex/swap` instead of `/api/bitflow/swap-params`
6. Update the "Powered by" footer from Bitflow to ALEX

- [ ] **Step 1: Replace the SwapWidget with ALEX-based implementation**

Replace the entire file content. Key changes from Bitflow version:

**Types** — Replace Bitflow `Token` and `QuoteResult` with:
```typescript
type AlexToken = {
  id: string;        // Currency ID e.g. "token-wstx"
  name: string;
  icon: string;
  wrapToken: string;
  wrapTokenDecimals: number;
  underlyingToken: string;
  underlyingTokenDecimals: number;
  price: number | null;
};

type QuoteData = {
  amountTo: number;
  feeRate: number;
  route: unknown;
};
```

**Token fetch** — Change endpoint:
```typescript
// Before
fetch("/api/bitflow/tokens")
// After
fetch("/api/alex/tokens")
```

**Token selector** — Update field access:
```typescript
// Before: t.tokenId, t.symbol, t.name, t.priceData.last_price, t.tokenContract, t.tokenDecimals
// After:  t.id,      t.name,   t.name, t.price,                t.underlyingToken, t.wrapTokenDecimals
```

Note: ALEX `TokenInfo` has `name` but no separate `symbol`. Use `name` for display. The `id` field (e.g. `"token-wstx"`) serves as the unique identifier (was `tokenId`).

**Balance fetch** — Update to use `underlyingToken` and `wrapTokenDecimals`:
```typescript
async function fetchFromBalance(address: string, token: AlexToken): Promise<number> {
  const isSTX = token.id === "token-wstx";

  if (isSTX) {
    const res = await fetch(`${HIRO_API}/v2/accounts/${address}?proof=0`);
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data.balance ?? 0) / 1e6;
  }

  const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
  if (!res.ok) return 0;
  const data = await res.json();
  const fts = (data.fungible_tokens ?? {}) as Record<string, { balance: string }>;

  const contractId = token.underlyingToken.toLowerCase();
  const match = Object.entries(fts).find(([key]) => key.toLowerCase().startsWith(contractId));
  if (!match) return 0;
  return Number(match[1].balance) / Math.pow(10, token.wrapTokenDecimals);
}
```

**Quote fetch** — Update to use new response shape:
```typescript
const fetchQuote = useCallback(async (from: AlexToken, to: AlexToken, amt: number) => {
  if (!from || !to || !amt || amt <= 0) { setQuote(null); setStatus("idle"); return; }
  setStatus("quoting");
  try {
    const res = await fetch(`/api/alex/quote?from=${from.id}&to=${to.id}&amount=${amt}`);
    const data: QuoteData | { error: string } = await res.json();
    if ("error" in data) throw new Error(data.error);
    setQuote(data);
    setStatus(data.amountTo > 0 ? "ready" : "idle");
  } catch (e) {
    setQuote(null);
    setStatus("error");
    setErrorMsg(e instanceof Error ? e.message : "Failed to get quote");
  }
}, []);
```

**Swap execution** — Simplify by using the new `/api/alex/swap` endpoint:
```typescript
async function handleSwap() {
  if (!quote || !stxAddress || !fromToken || !toToken) return;
  setStatus("swapping");
  setErrorMsg(null);

  try {
    const res = await fetch("/api/alex/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stxAddress,
        from: fromToken.id,
        to: toToken.id,
        amount: parseFloat(amountIn),
        slippage,
      }),
    });

    const raw = await res.json();
    if ("error" in raw) throw new Error(raw.error);

    const params = deserialize(raw) as {
      contractAddress: string;
      contractName: string;
      functionName: string;
      functionArgs: unknown[];
      postConditions: unknown[];
    };

    openContractCall({
      contractAddress: params.contractAddress,
      contractName: params.contractName,
      functionName: params.functionName,
      functionArgs: params.functionArgs as any[],
      postConditions: params.postConditions as any[],
      postConditionMode: PostConditionMode.Deny,
      network,
      onFinish: ({ txId: id }) => {
        setTxId(id);
        setStatus("success");
        addNotification(
          `Swap executed: ${fromToken?.name} → ${toToken?.name}`,
          'success', 'swap', 5000,
          { txId: id, amount: amountIn, tokenSymbol: toToken?.name }
        );
      },
      onCancel: () => setStatus("ready"),
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Swap failed";
    setErrorMsg(errorMessage);
    setStatus("error");
    addNotification(`Swap failed: ${errorMessage}`, 'error', 'swap', 5000);
  }
}
```

**Output display** — Update to use `quote.amountTo` instead of `quote.bestRoute.quote`:
```typescript
const amountOut = quote?.amountTo ?? null;
```

Remove route path display (ALEX doesn't expose token path in the same way). Replace with fee rate display if available.

**Footer** — Update branding:
```tsx
<p className="text-center text-[11px] text-gray-300 dark:text-gray-500">
  Powered by{" "}
  <a href="https://alexlab.co" target="_blank" rel="noopener noreferrer" className="text-[#B0E4CC] hover:text-[#408A71]">
    ALEX
  </a>
</p>
```

- [ ] **Step 2: Verify the app builds**

```bash
npm run build
```

Expected: No TypeScript errors related to Bitflow imports.

- [ ] **Step 3: Commit**

```bash
git add src/components/trade/SwapWidget.tsx
git commit -m "feat: migrate SwapWidget from Bitflow to ALEX SDK"
```

---

### Task 7: Clean up old bitflow API directory

**Files:**
- Delete: `src/app/api/bitflow/` (directory should be empty after tasks 3-5)

- [ ] **Step 1: Remove the empty bitflow API directory if anything remains**

```bash
rm -rf src/app/api/bitflow
```

- [ ] **Step 2: Verify no remaining bitflow references in source**

```bash
grep -r "bitflow" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: No results (DCA files reference bitflow contract names on-chain, which is fine — those are contract identifiers, not SDK usage).

Actually, DCA files reference `bitflow-sbtc-swap-router` which is an on-chain contract name — that stays.

- [ ] **Step 3: Commit**

```bash
git rm -r src/app/api/bitflow 2>/dev/null; git add -A src/app/api/bitflow
git commit -m "chore: remove empty bitflow API directory"
```

---

### Task 8: Update MigrationWidget footer branding

**Files:**
- Modify: `src/components/trade/MigrationWidget.tsx`

The MigrationWidget uses Bitflow's stableswap pool directly (on-chain contracts, not SDK), so the functionality stays. But the "Powered by Bitflow" footer should be updated since it references the dead service.

- [ ] **Step 1: Update footer text in MigrationWidget**

Change line ~462-468 from:
```tsx
<p className="text-center text-[11px] text-gray-300 dark:text-gray-500">
  Powered by{" "}
  <a href="https://bitflow.finance" target="_blank" rel="noopener noreferrer" className="text-[#B0E4CC] hover:text-[#408A71]">
    Bitflow
  </a>
  {" "}stableswap pool
</p>
```

To:
```tsx
<p className="text-center text-[11px] text-gray-300 dark:text-gray-500">
  Via Bitflow stableswap pool
</p>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/trade/MigrationWidget.tsx
git commit -m "chore: update MigrationWidget footer, remove dead Bitflow link"
```

---

### Task 9: Full build and smoke test

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 2: Start dev server and test token loading**

```bash
npm run dev
```

Open `http://localhost:3000/trade` and verify:
- Token list loads (not a 500 error)
- Tokens show names and icons
- Selecting two tokens and entering an amount shows a quote
- "Powered by ALEX" footer is visible

- [ ] **Step 3: Test swap flow (with wallet connected)**

- Connect wallet
- Select STX → any token
- Enter small amount
- Verify quote appears
- Click swap → wallet popup should appear

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any remaining migration issues"
```
