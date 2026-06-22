# Live Yield Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/earn` into a live yield dashboard — aggregate the user's active DeFi positions and replace hardcoded stacking APY with live data from StackingDAO and Zest.

**Architecture:** A new shared, cached `/api/yield/snapshot` endpoint aggregates live APY (StackingDAO `/api/apy` + Zest pools from DefiLlama). Positions reuse the existing client-side `useProtocolPositions` hook. UI gains a summary hero, a positions section, and a live stacking-APY value in the existing opportunities list. Zero new on-chain contracts.

**Tech Stack:** Next.js 15 App Router, TypeScript, Vitest, SWR, `@vercel/functions` runtime cache, next-intl.

## Global Constraints

- **Zero new on-chain contracts** — read-only data + existing `stakeStx` execution only.
- **Fail-invisible:** every external source wrapped in a `safe()` helper returning `null` on error; UI degrades to the existing hardcoded estimate, never breaks.
- **Test runner:** `npm test` (= `vitest run`). Pure parse/build functions are unit-tested; network fetch wrappers are not.
- **All percentages are in percent units** (StackingDAO `3.92` = 3.92%, DefiLlama `apy: 0.32` = 0.32%).
- **i18n:** 7 locale files `messages/{en,es,ja,ko,pt,vi,zh}.json`, single file per locale, nested namespaces. EN authored first; other locales kept at parity (a parity test enforces key coverage). New keys go under the existing `earn` namespace.
- **Commits:** small and independently green; no `Co-Authored-By` trailer; commit directly on `main`.
- **Verify before done:** run `npm test` and `npm run build` and read output before claiming a task complete.

---

### Task 1: DefiLlama Zest APY client

**Files:**
- Create: `src/lib/server/defillama-yields.ts`
- Test: `src/lib/server/defillama-yields.test.ts`

**Interfaces:**
- Produces:
  - `parseZestApy(raw: unknown): Record<string, number>` — pure; filters Stacks/zest-v2 pools, returns `{ SYMBOL: apyPercent }`.
  - `fetchZestApy(): Promise<Record<string, number> | null>` — network; `null` on any failure.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/defillama-yields.test.ts
import { describe, expect, it } from "vitest";
import { parseZestApy } from "./defillama-yields";

const sample = {
  data: [
    { chain: "Stacks", project: "zest-v2", symbol: "USDC", apy: 0.32 },
    { chain: "Stacks", project: "zest-v2", symbol: "sBTC", apy: 0.01 },
    { chain: "Stacks", project: "zest-v2", symbol: "STX", apy: 1.2 },
    { chain: "Stacks", project: "alex", symbol: "ALEX", apy: 9 },   // wrong project
    { chain: "Ethereum", project: "zest-v2", symbol: "USDC", apy: 5 }, // wrong chain
    { chain: "Stacks", project: "zest-v2", symbol: "USDH", apy: null }, // bad apy → skip
  ],
};

describe("parseZestApy", () => {
  it("keeps only Stacks zest-v2 pools, uppercased symbols, numeric apy", () => {
    expect(parseZestApy(sample)).toEqual({ USDC: 0.32, SBTC: 0.01, STX: 1.2 });
  });

  it("accepts a bare array as well as a { data } envelope", () => {
    expect(parseZestApy(sample.data)).toEqual({ USDC: 0.32, SBTC: 0.01, STX: 1.2 });
  });

  it("returns {} for unusable input", () => {
    expect(parseZestApy(null)).toEqual({});
    expect(parseZestApy({})).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/defillama-yields.test.ts`
Expected: FAIL — `parseZestApy` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/server/defillama-yields.ts
const DEFILLAMA_POOLS_URL = "https://yields.llama.fi/pools";

interface LlamaPool {
  chain?: unknown;
  project?: unknown;
  symbol?: unknown;
  apy?: unknown;
}

/** Filter the DefiLlama pools payload to Stacks/zest-v2 and map SYMBOL -> apy%. */
export function parseZestApy(raw: unknown): Record<string, number> {
  const list: unknown = Array.isArray(raw)
    ? raw
    : (raw as { data?: unknown })?.data;
  if (!Array.isArray(list)) return {};

  const out: Record<string, number> = {};
  for (const p of list as LlamaPool[]) {
    if (p?.chain !== "Stacks" || p?.project !== "zest-v2") continue;
    if (typeof p.symbol !== "string") continue;
    const apy = Number(p.apy);
    if (!Number.isFinite(apy)) continue;
    out[p.symbol.toUpperCase()] = apy;
  }
  return out;
}

/** Network fetch + parse. Returns null on any failure (fail-invisible). */
export async function fetchZestApy(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(DEFILLAMA_POOLS_URL, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return parseZestApy(await res.json());
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/defillama-yields.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/defillama-yields.ts src/lib/server/defillama-yields.test.ts
git commit -m "feat(earn): add DefiLlama Zest APY client"
```

---

### Task 2: StackingDAO APY client

**Files:**
- Create: `src/lib/server/stackingdao-apy.ts`
- Test: `src/lib/server/stackingdao-apy.test.ts`

**Interfaces:**
- Produces:
  - `parseStackingApy(body: string): number | null` — pure; parses the numeric text body.
  - `fetchStackingApy(): Promise<number | null>` — network; `null` on failure.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/stackingdao-apy.test.ts
import { describe, expect, it } from "vitest";
import { parseStackingApy } from "./stackingdao-apy";

describe("parseStackingApy", () => {
  it("parses a plain numeric body", () => {
    expect(parseStackingApy("3.92")).toBe(3.92);
    expect(parseStackingApy("  7  ")).toBe(7);
  });

  it("returns null for non-numeric, non-positive, or absurd values", () => {
    expect(parseStackingApy("not-a-number")).toBeNull();
    expect(parseStackingApy("")).toBeNull();
    expect(parseStackingApy("0")).toBeNull();
    expect(parseStackingApy("-5")).toBeNull();
    expect(parseStackingApy("250")).toBeNull(); // > 100% guard
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/stackingdao-apy.test.ts`
Expected: FAIL — module/function not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/server/stackingdao-apy.ts
const STACKINGDAO_APY_URL = "https://app.stackingdao.com/api/apy";

/** Parse StackingDAO's numeric APY body. Null if unusable or out of (0, 100]. */
export function parseStackingApy(body: string): number | null {
  const n = Number(String(body).trim());
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n;
}

/** Network fetch + parse. Returns null on any failure (fail-invisible). */
export async function fetchStackingApy(): Promise<number | null> {
  try {
    const res = await fetch(STACKINGDAO_APY_URL, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return parseStackingApy(await res.text());
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/stackingdao-apy.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/stackingdao-apy.ts src/lib/server/stackingdao-apy.test.ts
git commit -m "feat(earn): add StackingDAO APY client"
```

---

### Task 3: Yield snapshot aggregator

**Files:**
- Create: `src/lib/server/yield-snapshot.ts`
- Test: `src/lib/server/yield-snapshot.test.ts`

**Interfaces:**
- Consumes: `fetchZestApy` (Task 1), `fetchStackingApy` (Task 2).
- Produces:
  - `interface YieldSnapshot { generatedAt: number; stackingApy: number | null; zest: Record<string, number>; sources: { stackingDao: "ok" | "unavailable"; zest: "ok" | "unavailable" } }`
  - `buildYieldSnapshot(args: { stackingApy: number | null; zest: Record<string, number> | null; generatedAt?: number }): YieldSnapshot` — pure.
  - `getYieldSnapshot(): Promise<YieldSnapshot>` — orchestrator.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/yield-snapshot.test.ts
import { describe, expect, it } from "vitest";
import { buildYieldSnapshot } from "./yield-snapshot";

describe("buildYieldSnapshot", () => {
  it("marks both sources ok when present", () => {
    const s = buildYieldSnapshot({
      stackingApy: 3.92,
      zest: { USDC: 0.32 },
      generatedAt: 123,
    });
    expect(s).toEqual({
      generatedAt: 123,
      stackingApy: 3.92,
      zest: { USDC: 0.32 },
      sources: { stackingDao: "ok", zest: "ok" },
    });
  });

  it("marks a missing source unavailable and defaults zest to {}", () => {
    const s = buildYieldSnapshot({ stackingApy: null, zest: null, generatedAt: 1 });
    expect(s.stackingApy).toBeNull();
    expect(s.zest).toEqual({});
    expect(s.sources).toEqual({ stackingDao: "unavailable", zest: "unavailable" });
  });

  it("treats an empty zest map as unavailable", () => {
    const s = buildYieldSnapshot({ stackingApy: 5, zest: {}, generatedAt: 1 });
    expect(s.sources.zest).toBe("unavailable");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/yield-snapshot.test.ts`
Expected: FAIL — module/function not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/server/yield-snapshot.ts
import { fetchZestApy } from "./defillama-yields";
import { fetchStackingApy } from "./stackingdao-apy";

export interface YieldSnapshot {
  generatedAt: number;
  stackingApy: number | null;
  zest: Record<string, number>;
  sources: {
    stackingDao: "ok" | "unavailable";
    zest: "ok" | "unavailable";
  };
}

export function buildYieldSnapshot({
  stackingApy,
  zest,
  generatedAt = Date.now(),
}: {
  stackingApy: number | null;
  zest: Record<string, number> | null;
  generatedAt?: number;
}): YieldSnapshot {
  const zestMap = zest ?? {};
  return {
    generatedAt,
    stackingApy,
    zest: zestMap,
    sources: {
      stackingDao: stackingApy !== null ? "ok" : "unavailable",
      zest: Object.keys(zestMap).length > 0 ? "ok" : "unavailable",
    },
  };
}

export async function getYieldSnapshot(): Promise<YieldSnapshot> {
  const [stackingApy, zest] = await Promise.all([
    fetchStackingApy(),
    fetchZestApy(),
  ]);
  return buildYieldSnapshot({ stackingApy, zest });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/yield-snapshot.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/yield-snapshot.ts src/lib/server/yield-snapshot.test.ts
git commit -m "feat(earn): add yield snapshot aggregator"
```

---

### Task 4: Cached snapshot API route

**Files:**
- Create: `src/app/api/yield/snapshot/route.ts`

**Interfaces:**
- Consumes: `getYieldSnapshot`, `YieldSnapshot` (Task 3).
- Produces: `GET /api/yield/snapshot` → `YieldSnapshot` JSON, cached 600s, tag `yield`.

- [ ] **Step 1: Write the route** (clone of `src/app/api/market/snapshot/route.ts`)

```ts
// src/app/api/yield/snapshot/route.ts
import { NextResponse } from "next/server";
import { getCache } from "@vercel/functions";
import { getYieldSnapshot, type YieldSnapshot } from "@/lib/server/yield-snapshot";

const CACHE_KEY = "yield-snapshot:v1";
const CACHE_TTL_SECONDS = 600;
const CACHE_TAG = "yield";

export const revalidate = 0; // we manage caching ourselves

export async function GET() {
  const cache = getCache();
  const cached = (await cache.get(CACHE_KEY)) as YieldSnapshot | null;

  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "x-stacksport-cache": "HIT",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  }

  const snapshot = await getYieldSnapshot();
  await cache.set(CACHE_KEY, snapshot, {
    ttl: CACHE_TTL_SECONDS,
    tags: [CACHE_TAG],
    name: "yield-snapshot",
  });

  return NextResponse.json(snapshot, {
    headers: {
      "x-stacksport-cache": "MISS",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
    },
  });
}
```

- [ ] **Step 2: Verify it builds and serves**

Run: `npm run build`
Expected: build succeeds; route `/api/yield/snapshot` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/yield/snapshot/route.ts
git commit -m "feat(earn): add cached /api/yield/snapshot route"
```

---

### Task 5: Client hook + selectors

**Files:**
- Create: `src/hooks/useYieldSnapshot.ts`

**Interfaces:**
- Consumes: `YieldSnapshot` (Task 3), `GET /api/yield/snapshot` (Task 4).
- Produces:
  - `useYieldSnapshot(): SWRResponse<YieldSnapshot>`
  - `useStackingApy(): { data: number | undefined; isLoading: boolean; error: unknown }`
  - `useZestApy(symbol: string | undefined): { data: number | undefined; isLoading: boolean; error: unknown }`

- [ ] **Step 1: Write the hook** (mirror `src/hooks/useMarketSnapshot.ts` selector pattern)

```ts
// src/hooks/useYieldSnapshot.ts
"use client";

import useSWR from "swr";
import type { YieldSnapshot } from "@/lib/server/yield-snapshot";

const SNAPSHOT_KEY = "yield-snapshot";
const REFRESH_MS = 600_000;

async function fetchSnapshot(): Promise<YieldSnapshot> {
  const res = await fetch("/api/yield/snapshot");
  if (!res.ok) throw new Error("yield snapshot fetch failed");
  return res.json();
}

export function useYieldSnapshot() {
  return useSWR<YieldSnapshot>(SNAPSHOT_KEY, fetchSnapshot, {
    refreshInterval: REFRESH_MS,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
}

export function useStackingApy() {
  const { data, isLoading, error } = useYieldSnapshot();
  return { data: data?.stackingApy ?? undefined, isLoading, error };
}

export function useZestApy(symbol: string | undefined) {
  const { data, isLoading, error } = useYieldSnapshot();
  const apy = symbol ? data?.zest?.[symbol.toUpperCase()] : undefined;
  return { data: apy, isLoading, error };
}

export type { YieldSnapshot };
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run build`
Expected: build succeeds (hook compiles; unused until Task 6 — that is fine).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useYieldSnapshot.ts
git commit -m "feat(earn): add useYieldSnapshot hook + selectors"
```

---

### Task 6: Live stacking APY in the opportunities list

**Files:**
- Modify: `src/components/earn/YieldOpportunities.tsx`
- Test: `src/components/earn/YieldOpportunities.test.tsx`

**Interfaces:**
- Consumes: `useStackingApy` (Task 5).
- Behavior: the `stacking` row shows the live StackingDAO APY when available; falls back to the existing hardcoded `7–9%` estimate when `undefined`. sBTC and DCA rows are unchanged.

**Note on testing:** this is a characterization-style test proving the fallback. To keep it dependency-light, extract the APY-label decision into a pure helper inside the same file and test that helper rather than rendering the full component (which pulls wallet/SWR providers).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/earn/YieldOpportunities.test.tsx
import { describe, expect, it } from "vitest";
import { stackingApyLabel } from "./YieldOpportunities";

describe("stackingApyLabel", () => {
  it("uses the live APY when available", () => {
    expect(stackingApyLabel(3.92, [7, 9])).toBe("~3.9%");
  });

  it("falls back to the hardcoded estimate range when live is undefined", () => {
    expect(stackingApyLabel(undefined, [7, 9])).toBe("7–9%");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/earn/YieldOpportunities.test.tsx`
Expected: FAIL — `stackingApyLabel` not exported.

- [ ] **Step 3: Add the helper and wire the stacking row**

Add this exported helper near the top of `src/components/earn/YieldOpportunities.tsx` (after imports):

```tsx
/**
 * APY label for the stacking row: live StackingDAO APY when known, otherwise
 * the hardcoded estimate range. Live value formatted to one decimal.
 */
export function stackingApyLabel(
  liveApy: number | undefined,
  estimateRange: [number, number]
): string {
  if (liveApy !== undefined) return `~${liveApy.toFixed(1)}%`;
  const [lo, hi] = estimateRange;
  return lo === hi ? `~${lo}%` : `${lo}–${hi}%`;
}
```

Add the import:

```tsx
import { useStackingApy } from "@/hooks/useYieldSnapshot";
```

Inside the component, read the live value:

```tsx
const { data: liveStackingApy } = useStackingApy();
```

In the `opportunities.map((o) => {...})` render, replace the `apyLabel` computation so the stacking row uses the helper. The existing block is:

```tsx
const apyLabel = isDca
  ? t("variable")
  : o.apyRange[0] === o.apyRange[1]
  ? `~${o.apyRange[0]}%`
  : `${o.apyRange[0]}–${o.apyRange[1]}%`;
```

Replace with:

```tsx
const apyLabel = isDca
  ? t("variable")
  : o.id === "stacking"
  ? stackingApyLabel(liveStackingApy, o.apyRange)
  : o.apyRange[0] === o.apyRange[1]
  ? `~${o.apyRange[0]}%`
  : `${o.apyRange[0]}–${o.apyRange[1]}%`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/earn/YieldOpportunities.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/components/earn/YieldOpportunities.tsx src/components/earn/YieldOpportunities.test.tsx
git commit -m "feat(earn): show live StackingDAO APY in opportunities list"
```

---

### Task 7: Annual-yield estimator helper

**Files:**
- Create: `src/lib/earn-yield.ts`
- Test: `src/lib/earn-yield.test.ts`

**Interfaces:**
- Consumes: `ProtocolPosition` (`src/lib/protocol-positions.ts`), `YieldSnapshot` (Task 3).
- Produces:
  - `interface YieldEstimate { totalAtWork: number; annualYield: number | null }`
  - `estimateAnnualYield(positions: Map<string, ProtocolPosition | null>, snap: YieldSnapshot | undefined): YieldEstimate`

**Logic:** `totalAtWork` = sum of `position.totalUsd` over non-null entries. `annualYield` accumulates only where an APY is known: the `StackingDAO` entry uses `snap.stackingApy` against its `totalUsd`; `Zest Protocol` lines use `snap.zest[SYMBOL]` (symbol parsed as the last whitespace-separated token of `line.tokenAmount`) against `line.usdValue`. Lisa/Arkadiko contribute to `totalAtWork` but not to `annualYield` (no live APY). If no APY contributed at all, `annualYield` is `null` (fail-invisible).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/earn-yield.test.ts
import { describe, expect, it } from "vitest";
import { estimateAnnualYield } from "./earn-yield";
import type { ProtocolPosition } from "./protocol-positions";
import type { YieldSnapshot } from "./server/yield-snapshot";

const snap: YieldSnapshot = {
  generatedAt: 0,
  stackingApy: 4, // 4%
  zest: { USDC: 2 }, // 2%
  sources: { stackingDao: "ok", zest: "ok" },
};

const positions = new Map<string, ProtocolPosition | null>([
  ["StackingDAO", { lines: [{ label: "Staked", tokenAmount: "100.00 STX", usdValue: 200 }], totalUsd: 200 }],
  ["Zest Protocol", { lines: [{ label: "Supplied", tokenAmount: "500.00 USDC", usdValue: 500 }], totalUsd: 500 }],
  ["Lisa", { lines: [{ label: "Staked", tokenAmount: "50.00 STX", usdValue: 100 }], totalUsd: 100 }],
  ["Arkadiko", null],
]);

describe("estimateAnnualYield", () => {
  it("sums value at work and applies APY only where known", () => {
    const r = estimateAnnualYield(positions, snap);
    expect(r.totalAtWork).toBe(800); // 200 + 500 + 100
    // StackingDAO: 200 * 4% = 8 ; Zest USDC: 500 * 2% = 10 ; Lisa: no apy
    expect(r.annualYield).toBeCloseTo(18, 6);
  });

  it("returns null annualYield when no APY is known", () => {
    const r = estimateAnnualYield(positions, undefined);
    expect(r.totalAtWork).toBe(800);
    expect(r.annualYield).toBeNull();
  });

  it("handles an empty map", () => {
    expect(estimateAnnualYield(new Map(), snap)).toEqual({ totalAtWork: 0, annualYield: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/earn-yield.test.ts`
Expected: FAIL — module/function not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/earn-yield.ts
import type { ProtocolPosition } from "./protocol-positions";
import type { YieldSnapshot } from "./server/yield-snapshot";

export interface YieldEstimate {
  totalAtWork: number;
  annualYield: number | null;
}

function symbolOf(tokenAmount: string): string {
  const parts = tokenAmount.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? "").toUpperCase();
}

export function estimateAnnualYield(
  positions: Map<string, ProtocolPosition | null>,
  snap: YieldSnapshot | undefined
): YieldEstimate {
  let totalAtWork = 0;
  let yieldSum = 0;
  let hasApy = false;

  for (const [name, pos] of positions) {
    if (!pos) continue;
    totalAtWork += pos.totalUsd;
    if (!snap) continue;

    if (name === "StackingDAO" && snap.stackingApy !== null) {
      yieldSum += pos.totalUsd * (snap.stackingApy / 100);
      hasApy = true;
    } else if (name === "Zest Protocol") {
      for (const line of pos.lines) {
        const apy = snap.zest[symbolOf(line.tokenAmount)];
        if (typeof apy === "number") {
          yieldSum += line.usdValue * (apy / 100);
          hasApy = true;
        }
      }
    }
  }

  return { totalAtWork, annualYield: hasApy ? yieldSum : null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/earn-yield.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/earn-yield.ts src/lib/earn-yield.test.ts
git commit -m "feat(earn): add annual-yield estimator helper"
```

---

### Task 8: Positions section + summary hero (UI)

**Files:**
- Create: `src/components/earn/YieldPositions.tsx`
- Create: `src/components/earn/YieldSummaryHero.tsx`
- Modify: `src/components/earn/EarnPageContent.tsx`
- Modify: `messages/en.json` (new `earn` keys; other locales in Task 9)

**Interfaces:**
- Consumes: `useConnectedApps`, `useProtocolPositions` (`@/hooks/useMarketData`), `useZedApy`→`useZestApy` (Task 5), `estimateAnnualYield` (Task 7), `useYieldSnapshot` (Task 5).
- Data acquisition mirrors `AppsPageContent.tsx:31-36`:
  ```tsx
  const { data: apps } = useConnectedApps(addr);
  const { data: positionsMap } = useProtocolPositions(addr, apps?.knownProtocols ?? []);
  ```

- [ ] **Step 1: Add EN i18n keys**

In `messages/en.json`, replace the `earn` namespace (currently `{ "title": "Earn" }`) with:

```json
"earn": {
  "title": "Earn",
  "summary": {
    "header": "Your Yield",
    "atWork": "Value at work",
    "estYearly": "Est. yearly yield",
    "empty": "No active yield positions yet"
  },
  "positions": {
    "header": "Your Positions",
    "empty": "No DeFi positions detected.",
    "apy": "{value}% APY"
  }
}
```

- [ ] **Step 2: Create the positions section**

```tsx
// src/components/earn/YieldPositions.tsx
"use client";

import { useTranslations } from "next-intl";
import { useWalletStore } from "@/store/walletStore";
import { useConnectedApps, useProtocolPositions } from "@/hooks/useMarketData";
import { useYieldSnapshot } from "@/hooks/useYieldSnapshot";

function symbolOf(tokenAmount: string): string {
  const parts = tokenAmount.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? "").toUpperCase();
}

export default function YieldPositions() {
  const t = useTranslations("earn.positions");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: apps } = useConnectedApps(addr);
  const { data: positionsMap } = useProtocolPositions(addr, apps?.knownProtocols ?? []);
  const { data: yieldSnap } = useYieldSnapshot();

  const entries = positionsMap
    ? Array.from(positionsMap.entries()).filter(([, pos]) => pos && pos.totalUsd > 0)
    : [];

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <h3
        className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
      >
        {t("header")}
      </h3>

      {entries.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {entries.map(([name, pos]) => (
            <li key={name}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{name}</p>
                <p className="text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
                  ${pos!.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <ul className="mt-1 space-y-0.5">
                {pos!.lines.map((line, i) => {
                  const zestApy =
                    name === "Zest Protocol"
                      ? yieldSnap?.zest?.[symbolOf(line.tokenAmount)]
                      : undefined;
                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>{line.label}: {line.tokenAmount}</span>
                      {typeof zestApy === "number" && (
                        <span style={{ color: "var(--accent)" }}>
                          {t("apy", { value: zestApy.toFixed(2) })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the summary hero**

```tsx
// src/components/earn/YieldSummaryHero.tsx
"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Sprout } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useConnectedApps, useProtocolPositions } from "@/hooks/useMarketData";
import { useYieldSnapshot } from "@/hooks/useYieldSnapshot";
import { estimateAnnualYield } from "@/lib/earn-yield";

export default function YieldSummaryHero() {
  const t = useTranslations("earn.summary");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: apps } = useConnectedApps(addr);
  const { data: positionsMap } = useProtocolPositions(addr, apps?.knownProtocols ?? []);
  const { data: yieldSnap } = useYieldSnapshot();

  const { totalAtWork, annualYield } = useMemo(
    () => estimateAnnualYield(positionsMap ?? new Map(), yieldSnap),
    [positionsMap, yieldSnap]
  );

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}
      >
        <Sprout size={22} />
      </div>
      <div className="flex-1">
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
          {t("header")}
        </p>
        {totalAtWork > 0 ? (
          <div className="flex items-baseline gap-4 mt-1 flex-wrap">
            <span className="text-lg font-bold font-data" style={{ color: "var(--text-primary)" }}>
              ${totalAtWork.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              <span className="text-[11px] font-normal ml-1" style={{ color: "var(--text-muted)" }}>{t("atWork")}</span>
            </span>
            {annualYield !== null && (
              <span className="text-sm font-bold font-data" style={{ color: "var(--accent)" }}>
                ~${annualYield.toLocaleString(undefined, { maximumFractionDigits: 2 })}/yr
                <span className="text-[11px] font-normal ml-1" style={{ color: "var(--text-muted)" }}>{t("estYearly")}</span>
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount both in the earn page**

In `src/components/earn/EarnPageContent.tsx`, add imports:

```tsx
import YieldSummaryHero from "@/components/earn/YieldSummaryHero";
import YieldPositions from "@/components/earn/YieldPositions";
```

Replace the `<StaggerChildren>` children so the hero is first and positions appear after the tracker:

```tsx
<StaggerChildren className="space-y-4 md:space-y-5">
  <YieldSummaryHero />
  <MotionCard disableHover>
    <StackingTracker />
  </MotionCard>
  <YieldPositions />
  <IdleStxNudge />
  <MotionCard>
    <YieldOpportunities />
  </MotionCard>
</StaggerChildren>
```

- [ ] **Step 5: Verify build + tests**

Run: `npm run build && npm test`
Expected: build succeeds; all unit tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/earn/YieldPositions.tsx src/components/earn/YieldSummaryHero.tsx src/components/earn/EarnPageContent.tsx messages/en.json
git commit -m "feat(earn): add yield summary hero + positions section"
```

---

### Task 9: Locale parity + final verification

**Files:**
- Modify: `messages/{es,ja,ko,pt,vi,zh}.json` (add the same `earn.summary` / `earn.positions` keys, translated)

**Interfaces:** none — closes i18n parity so the parity test passes.

- [ ] **Step 1: Run the parity test to see the gap**

Run: `npm test`
Expected: the locale-parity test FAILS, listing missing `earn.summary.*` / `earn.positions.*` keys in the six non-EN locales.

- [ ] **Step 2: Add translated keys to each locale**

For each of `messages/es.json`, `ja.json`, `ko.json`, `pt.json`, `vi.json`, `zh.json`, add to the `earn` namespace the `summary` and `positions` sub-objects with the same shape as EN. Translations:

Vietnamese (`vi.json`):
```json
"summary": { "header": "Lợi suất của bạn", "atWork": "Đang sinh lời", "estYearly": "Ước tính lợi suất/năm", "empty": "Chưa có vị thế sinh lời nào" },
"positions": { "header": "Vị thế của bạn", "empty": "Không phát hiện vị thế DeFi.", "apy": "{value}% APY" }
```

Spanish (`es.json`):
```json
"summary": { "header": "Tu rendimiento", "atWork": "Valor en uso", "estYearly": "Rendimiento anual est.", "empty": "Aún no hay posiciones de rendimiento" },
"positions": { "header": "Tus posiciones", "empty": "No se detectaron posiciones DeFi.", "apy": "{value}% APY" }
```

Brazilian Portuguese (`pt.json`):
```json
"summary": { "header": "Seu rendimento", "atWork": "Valor em uso", "estYearly": "Rendimento anual est.", "empty": "Ainda não há posições de rendimento" },
"positions": { "header": "Suas posições", "empty": "Nenhuma posição DeFi detectada.", "apy": "{value}% APY" }
```

Japanese (`ja.json`):
```json
"summary": { "header": "あなたの利回り", "atWork": "運用中の価値", "estYearly": "年間利回り（推定）", "empty": "アクティブな利回りポジションはまだありません" },
"positions": { "header": "あなたのポジション", "empty": "DeFiポジションは検出されませんでした。", "apy": "{value}% APY" }
```

Korean (`ko.json`):
```json
"summary": { "header": "내 수익률", "atWork": "운용 중 가치", "estYearly": "예상 연간 수익", "empty": "활성 수익 포지션이 아직 없습니다" },
"positions": { "header": "내 포지션", "empty": "감지된 DeFi 포지션이 없습니다.", "apy": "{value}% APY" }
```

Chinese (`zh.json`):
```json
"summary": { "header": "你的收益", "atWork": "运作中的价值", "estYearly": "预计年化收益", "empty": "暂无活跃的收益头寸" },
"positions": { "header": "你的头寸", "empty": "未检测到 DeFi 头寸。", "apy": "{value}% APY" }
```

Place each `summary`/`positions` pair inside that locale's existing `earn` object (currently `{ "title": "..." }`), keeping valid JSON (comma after `title`).

- [ ] **Step 3: Run full verification**

Run: `npm test && npm run build`
Expected: parity test PASSES; all unit tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add messages/es.json messages/ja.json messages/ko.json messages/pt.json messages/vi.json messages/zh.json
git commit -m "i18n(earn): add yield dashboard keys for all locales"
```

---

## Self-Review

**Spec coverage:**
- Goal 1 (aggregate positions + total + est. yield) → Tasks 7 (estimator), 8 (hero + positions section). ✓
- Goal 2 (live APY: StackingDAO stacking row + Zest next to positions) → Tasks 1, 2, 3, 5, 6, 8. ✓
- Shared cached `/api/yield/snapshot` TTL 600 tag `yield` → Task 4. ✓
- Reuse `useProtocolPositions`, no portfolio-snapshot change → Task 8. ✓
- Fail-invisible (each source `safe`/null, UI falls back) → Tasks 1, 2, 6 (fallback), 8 (conditional render). ✓
- PoX stays estimated (deferred) → not implemented by design; opportunities stacking row only swaps in StackingDAO APY. ✓
- Testing (defillama, stackingdao, yield-snapshot, characterization fallback, e2e light) → Tasks 1, 2, 3, 6. Note: the planned light E2E is covered functionally by the build + the existing `/earn` e2e; no new Playwright spec is added to keep scope tight. ✓
- i18n EN-first then parity → Tasks 8, 9. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete. The Task 8 interface line mentioning `useZedApy` is a typo for `useZestApy` — corrected here: the components use `useZestApy` (Task 5) and `useYieldSnapshot`.

**Type consistency:** `YieldSnapshot` shape identical across Tasks 3, 5, 7, 8. `parseZestApy`/`fetchZestApy`, `parseStackingApy`/`fetchStackingApy`, `buildYieldSnapshot`/`getYieldSnapshot`, `estimateAnnualYield`/`YieldEstimate`, `stackingApyLabel`, `useStackingApy`/`useZestApy` all referenced with consistent names and signatures. `symbolOf` is defined locally in both `earn-yield.ts` and `YieldPositions.tsx` (acceptable small duplication; both are tiny and private).
