# Smart DCA — Conditional Buy-the-Dip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a STX→sBTC DCA plan carry an optional "buy-the-dip" condition; the keeper only executes a due plan when the current sats/STX rate is ≥ a threshold above its N-day average, deferring otherwise up to a cap, then market-buying.

**Architecture:** Fully off-chain and additive — no contract change. Pure decision/signal functions are unit-tested per package; the keeper filters which due vault-0 plans enter the batch; config lives in Upstash Redis written via new Next.js API routes; a small frontend store + UI manage conditions. Fail-open everywhere.

**Tech Stack:** TypeScript. Keeper: `@upstash/redis`, CoinGecko REST, hand-rolled assert tests (`node --loader ts-node/esm`, matching `keeper-bot/src/circuit-breaker.test.ts`). Frontend: Next.js 15 App Router, Zustand, SWR, Vitest (`npm test`).

**Reference spec:** `docs/superpowers/specs/2026-05-30-smart-dca-dip-buy-design.md`

---

## File Structure

**Keeper (`keeper-bot/src/`):**
- Create `smart-dca.ts` — pure types + decision functions (`computeSatsPerStxSeries`, `sma`, `evaluateDipCondition`, `decideBatch`).
- Create `smart-dca.test.ts` — hand-rolled assert suite for the pure functions.
- Create `smart-dca-store.ts` — Redis IO for config + defer counter (thin), plus pure key/parse helpers.
- Create `smart-dca-signal.ts` — CoinGecko fetch wrapper building `{ current, series }`.
- Modify `index.ts` — insert the filter step into `runOnce()` and persist defer updates.
- Modify `dca-push.ts` — accept an optional per-plan dip note in the execution push.

**Frontend:**
- Create `src/lib/smart-dca.ts` — shared types + `validateConfigInput` + `premium` (pure, Vitest).
- Create `src/lib/smart-dca.test.ts` — Vitest suite for the pure functions.
- Create `src/lib/smart-dca-redis.ts` — Redis IO mirroring `src/lib/push-redis.ts`.
- Create `src/app/api/dca/smart/route.ts` — GET/POST/DELETE config.
- Create `src/app/api/dca/smart/signal/route.ts` — read-only current/sma/premium.
- Create `src/store/smartDcaStore.ts` — Zustand mirror.
- Create `src/hooks/useSmartDca.ts` — SWR hydration + mutations.
- Create `src/components/dca/SmartDcaPanel.tsx` — toggle + inputs + live status.

**Conventions to follow:**
- Keeper Redis IO mirrors `keeper-bot/src/redis-store.ts` (`Redis.fromEnv()`, `JSON.stringify` on write, tolerate string|object on read).
- Frontend Redis IO mirrors `src/lib/push-redis.ts` (`getRedis()` returns `null` when env missing; never throw).
- Commit style: no `Co-Authored-By` trailer. Fine granularity — RED and GREEN are separate commits, each green.

---

## Task 1: Keeper pure decision functions

**Files:**
- Create: `keeper-bot/src/smart-dca.ts`
- Create: `keeper-bot/src/smart-dca.test.ts`

- [ ] **Step 1: Write `keeper-bot/src/smart-dca.ts` with types + functions**

```typescript
// keeper-bot/src/smart-dca.ts
// Pure decision logic for Smart DCA ("buy the dip"). No IO here — see
// smart-dca-store.ts (Redis) and smart-dca-signal.ts (CoinGecko).

import type { BatchPlan } from "./batch-executor.js";

export interface SmartDcaConfig {
  owner: string;
  thresholdBps: number;       // e.g. 500 = 5.00% above the N-day average
  windowDays: number;         // SMA window, 1..30
  maxDeferIntervals: number;  // skip at most K keeper runs before a market buy
  createdAt: number;          // unix seconds
}

export interface SatsPerStxSignal {
  current: number;            // current sats per 1 STX
  series: number[];           // daily sats/STX, oldest → newest
}

export type DipAction = "execute" | "skip";

export interface DipDecision {
  action: DipAction;
  reason: string;
  nextDefer: number;          // defer counter to persist after this decision
}

// sats/STX = (STX_USD / BTC_USD) * 1e8, element-wise over aligned daily series.
// Skips any index where BTC price is 0 or inputs are missing.
export function computeSatsPerStxSeries(
  stxUsd: number[],
  btcUsd: number[]
): number[] {
  const n = Math.min(stxUsd.length, btcUsd.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = stxUsd[i];
    const b = btcUsd[i];
    if (!(b > 0) || !(s >= 0)) continue;
    out.push((s / b) * 1e8);
  }
  return out;
}

// Average of the last `windowDays` values. If the series is shorter, averages
// what exists. Returns 0 for an empty series (caller treats 0 as "no signal").
export function sma(series: number[], windowDays: number): number {
  if (series.length === 0) return 0;
  const w = Math.max(1, Math.min(windowDays, series.length));
  const slice = series.slice(series.length - w);
  const total = slice.reduce((acc, v) => acc + v, 0);
  return total / slice.length;
}

// Core per-plan decision. `current` and `avg` are sats/STX; `current > avg` means
// STX buys more sats than usual (a good entry).
export function evaluateDipCondition(args: {
  current: number;
  avg: number;
  thresholdBps: number;
  deferCount: number;
  maxDeferIntervals: number;
}): DipDecision {
  const { current, avg, thresholdBps, deferCount, maxDeferIntervals } = args;

  // No usable signal → fail-open: execute as a normal DCA, reset counter.
  if (!(avg > 0) || !(current > 0)) {
    return { action: "execute", reason: "no-signal-fail-open", nextDefer: 0 };
  }

  const premium = current / avg - 1;
  if (premium >= thresholdBps / 10_000) {
    return { action: "execute", reason: "dip-hit", nextDefer: 0 };
  }

  if (deferCount + 1 > maxDeferIntervals) {
    return { action: "execute", reason: "defer-cap-market-buy", nextDefer: 0 };
  }

  return { action: "skip", reason: "below-threshold", nextDefer: deferCount + 1 };
}

// Decide which due plans go into the batch. Only vault-0 plans with a config are
// gated; everything else passes through unchanged (backward compatible).
export function decideBatch(args: {
  plans: BatchPlan[];
  configs: Map<number, SmartDcaConfig>;
  deferByPlan: Map<number, number>;
  signal: SatsPerStxSignal | null;
}): {
  toExecute: BatchPlan[];
  deferWrites: Map<number, number>; // planId → new defer value to persist
} {
  const { plans, configs, deferByPlan, signal } = args;
  const toExecute: BatchPlan[] = [];
  const deferWrites = new Map<number, number>();

  for (const plan of plans) {
    const cfg = plan.vaultType === 0 ? configs.get(plan.planId) : undefined;
    if (!cfg) {
      toExecute.push(plan);
      continue;
    }

    const avg = signal ? sma(signal.series, cfg.windowDays) : 0;
    const decision = evaluateDipCondition({
      current: signal?.current ?? 0,
      avg,
      thresholdBps: cfg.thresholdBps,
      deferCount: deferByPlan.get(plan.planId) ?? 0,
      maxDeferIntervals: cfg.maxDeferIntervals,
    });

    deferWrites.set(plan.planId, decision.nextDefer);
    if (decision.action === "execute") toExecute.push(plan);
  }

  return { toExecute, deferWrites };
}
```

- [ ] **Step 2: Write `keeper-bot/src/smart-dca.test.ts` (hand-rolled, matches circuit-breaker.test.ts style)**

```typescript
// Run with: node --loader ts-node/esm src/smart-dca.test.ts
import {
  computeSatsPerStxSeries,
  sma,
  evaluateDipCondition,
  decideBatch,
  type SmartDcaConfig,
} from "./smart-dca.js";
import type { BatchPlan } from "./batch-executor.js";

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log("OK:", msg);
  } else {
    console.error("FAIL:", msg);
    failures++;
  }
}
function close(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

// computeSatsPerStxSeries
{
  const s = computeSatsPerStxSeries([2, 2.5], [50000, 40000]);
  assert(close(s[0], (2 / 50000) * 1e8), "sats/STX[0] = 4000");
  assert(close(s[1], (2.5 / 40000) * 1e8), "sats/STX[1] = 6250");
  assert(
    computeSatsPerStxSeries([2, 2], [0, 50000]).length === 1,
    "skips index with btc=0"
  );
  assert(
    computeSatsPerStxSeries([2, 2, 2], [50000, 50000]).length === 2,
    "truncates to shorter length"
  );
}

// sma
{
  assert(close(sma([10, 20, 30], 3), 20), "sma full window");
  assert(close(sma([10, 20, 30, 40], 2), 35), "sma last 2");
  assert(close(sma([10, 20], 7), 15), "sma window > length averages all");
  assert(sma([], 7) === 0, "sma empty = 0");
}

// evaluateDipCondition
{
  const base = { thresholdBps: 500, deferCount: 0, maxDeferIntervals: 2 };
  assert(
    evaluateDipCondition({ ...base, current: 106, avg: 100 }).action === "execute",
    "premium 6% >= 5% → execute (dip-hit)"
  );
  const skip = evaluateDipCondition({ ...base, current: 102, avg: 100 });
  assert(skip.action === "skip" && skip.nextDefer === 1, "premium 2% → skip, defer=1");
  const cap = evaluateDipCondition({ ...base, current: 102, avg: 100, deferCount: 2 });
  assert(
    cap.action === "execute" && cap.reason === "defer-cap-market-buy" && cap.nextDefer === 0,
    "defer cap exceeded → market buy, reset"
  );
  const open = evaluateDipCondition({ ...base, current: 100, avg: 0 });
  assert(open.action === "execute" && open.reason === "no-signal-fail-open", "no signal → fail-open");
}

// decideBatch
{
  const plans: BatchPlan[] = [
    { planId: 1, vaultType: 0 },
    { planId: 2, vaultType: 0 },
    { planId: 3, vaultType: 1 },
  ];
  const cfg: SmartDcaConfig = {
    owner: "SP1", thresholdBps: 500, windowDays: 7, maxDeferIntervals: 2, createdAt: 0,
  };
  const configs = new Map<number, SmartDcaConfig>([[1, cfg], [2, cfg]]);
  const deferByPlan = new Map<number, number>();
  const signal = { current: 102, series: [100, 100, 100] }; // premium 2% < 5%
  const r = decideBatch({ plans, configs, deferByPlan, signal });
  assert(
    r.toExecute.length === 1 && r.toExecute[0].planId === 3,
    "configless vault-1 plan passes; gated vault-0 plans skipped"
  );
  assert(r.deferWrites.get(1) === 1 && r.deferWrites.get(2) === 1, "defer incremented for skipped");

  const r2 = decideBatch({ plans, configs, deferByPlan, signal: null });
  assert(r2.toExecute.length === 3, "null signal → fail-open, all execute");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 3: Run the test, verify it passes**

Run: `cd keeper-bot && node --loader ts-node/esm src/smart-dca.test.ts`
Expected: every line `OK:` then `ALL PASS`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add keeper-bot/src/smart-dca.ts keeper-bot/src/smart-dca.test.ts
git commit -m "feat(keeper): pure decision functions for Smart DCA dip condition"
```

---

## Task 2: Keeper Redis store for config + defer counter

**Files:**
- Create: `keeper-bot/src/smart-dca-store.ts`
- Modify: `keeper-bot/src/smart-dca.test.ts` (append pure-helper assertions)

- [ ] **Step 1: Write `keeper-bot/src/smart-dca-store.ts`**

```typescript
// keeper-bot/src/smart-dca-store.ts
// Redis IO for Smart DCA config + defer counter. IO is thin (mirrors
// redis-store.ts); the testable parts are the pure key/parse helpers below.
import { Redis } from "@upstash/redis";
import type { SmartDcaConfig } from "./smart-dca.js";

const CONFIG_HASH = "smart-dca:v0:config"; // field = planId, value = JSON config
const DEFER_HASH  = "smart-dca:v0:defer";  // field = planId, value = integer

const redis = Redis.fromEnv();

export function parseConfig(raw: unknown): SmartDcaConfig | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || typeof obj !== "object") return null;
  const c = obj as Record<string, unknown>;
  if (
    typeof c.owner !== "string" ||
    typeof c.thresholdBps !== "number" ||
    typeof c.windowDays !== "number" ||
    typeof c.maxDeferIntervals !== "number"
  ) return null;
  return {
    owner: c.owner,
    thresholdBps: c.thresholdBps,
    windowDays: c.windowDays,
    maxDeferIntervals: c.maxDeferIntervals,
    createdAt: typeof c.createdAt === "number" ? c.createdAt : 0,
  };
}

export function parseDefer(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : (raw as number);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// Returns Map<planId, config> for all configured vault-0 plans.
export async function readAllConfigs(): Promise<Map<number, SmartDcaConfig>> {
  const raw = await redis.hgetall<Record<string, unknown>>(CONFIG_HASH);
  const out = new Map<number, SmartDcaConfig>();
  if (!raw) return out;
  for (const [field, v] of Object.entries(raw)) {
    const cfg = parseConfig(v);
    const id = Number(field);
    if (cfg && Number.isFinite(id)) out.set(id, cfg);
  }
  return out;
}

export async function readAllDefers(): Promise<Map<number, number>> {
  const raw = await redis.hgetall<Record<string, unknown>>(DEFER_HASH);
  const out = new Map<number, number>();
  if (!raw) return out;
  for (const [field, v] of Object.entries(raw)) {
    const id = Number(field);
    if (Number.isFinite(id)) out.set(id, parseDefer(v));
  }
  return out;
}

// Persist defer values produced by decideBatch. Writes each field individually
// so a single bad field can't lose the rest.
export async function writeDefers(deferWrites: Map<number, number>): Promise<void> {
  for (const [planId, value] of deferWrites) {
    await redis.hset(DEFER_HASH, { [String(planId)]: String(value) });
  }
}
```

- [ ] **Step 2: Append pure-helper assertions to `keeper-bot/src/smart-dca.test.ts`**

Add these blocks above the final `console.log(...)` summary line, and add the import at the top of the file:

```typescript
// add to the import list at the top of smart-dca.test.ts:
import { parseConfig, parseDefer } from "./smart-dca-store.js";
```

```typescript
// parseConfig / parseDefer
{
  const good = JSON.stringify({
    owner: "SP1", thresholdBps: 500, windowDays: 7, maxDeferIntervals: 2, createdAt: 9,
  });
  const c = parseConfig(good);
  assert(c !== null && c.owner === "SP1" && c.thresholdBps === 500, "parseConfig good JSON string");
  assert(parseConfig("{not json") === null, "parseConfig malformed → null");
  assert(parseConfig({ owner: "SP1" }) === null, "parseConfig missing fields → null");
  assert(parseDefer("3") === 3, "parseDefer string → 3");
  assert(parseDefer(undefined) === 0, "parseDefer undefined → 0");
  assert(parseDefer(-1) === 0, "parseDefer negative → 0");
}
```

- [ ] **Step 3: Run the test, verify it passes**

Run: `cd keeper-bot && node --loader ts-node/esm src/smart-dca.test.ts`
Expected: `ALL PASS`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add keeper-bot/src/smart-dca-store.ts keeper-bot/src/smart-dca.test.ts
git commit -m "feat(keeper): Redis store for Smart DCA config and defer counter"
```

---

## Task 3: Keeper signal fetch wrapper

**Files:**
- Create: `keeper-bot/src/smart-dca-signal.ts`
- Create: `keeper-bot/src/smart-dca-signal.test.ts`

- [ ] **Step 1: Write `keeper-bot/src/smart-dca-signal.ts`**

```typescript
// keeper-bot/src/smart-dca-signal.ts
// Builds the sats/STX signal from CoinGecko daily market charts. Fail-open:
// any error returns null and the caller treats every plan as configless.
import { computeSatsPerStxSeries, type SatsPerStxSignal } from "./smart-dca.js";
import { log } from "./logger.js";

const CG = "https://api.coingecko.com/api/v3";

async function fetchDailyUsd(coin: string, days: number): Promise<number[]> {
  const res = await fetch(
    `${CG}/coins/${coin}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`coingecko ${coin} ${res.status}`);
  const data = (await res.json()) as { prices: [number, number][] };
  return (data.prices ?? []).map(([, v]) => v);
}

// maxDays should cover the largest windowDays across all configs (cap 30).
export async function fetchSatsPerStxSignal(
  maxDays: number
): Promise<SatsPerStxSignal | null> {
  try {
    const days = Math.max(1, Math.min(maxDays, 30));
    const [stx, btc] = await Promise.all([
      fetchDailyUsd("blockstack", days),
      fetchDailyUsd("bitcoin", days),
    ]);
    const series = computeSatsPerStxSeries(stx, btc);
    if (series.length === 0) {
      log.warn("smart-dca signal: empty series, failing open");
      return null;
    }
    return { current: series[series.length - 1], series };
  } catch (err) {
    log.warn("smart-dca signal fetch failed, failing open", { err: String(err) });
    return null;
  }
}
```

- [ ] **Step 2: Write `keeper-bot/src/smart-dca-signal.test.ts` (mocks global fetch)**

```typescript
// Run with: node --loader ts-node/esm src/smart-dca-signal.test.ts
import { fetchSatsPerStxSignal } from "./smart-dca-signal.js";

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) console.log("OK:", msg);
  else { console.error("FAIL:", msg); failures++; }
}

const realFetch = globalThis.fetch;
function mockFetch(map: Record<string, unknown>): void {
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    const key = u.includes("/coins/bitcoin/") ? "btc" : "stx";
    const body = map[key];
    if (body === undefined) return { ok: false, status: 500 } as Response;
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
}

async function main(): Promise<void> {
  // happy path: STX 2 USD, BTC 50000 USD → 4000 sats/STX
  mockFetch({
    stx: { prices: [[1, 2], [2, 2]] },
    btc: { prices: [[1, 50000], [2, 50000]] },
  });
  const sig = await fetchSatsPerStxSignal(7);
  assert(sig !== null && Math.abs(sig.current - 4000) < 1e-6, "builds current 4000 sats/STX");
  assert(sig !== null && sig.series.length === 2, "series length 2");

  // error path → null (fail-open)
  mockFetch({}); // every fetch returns 500
  const sig2 = await fetchSatsPerStxSignal(7);
  assert(sig2 === null, "fetch error → null");

  globalThis.fetch = realFetch;
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
```

- [ ] **Step 3: Run the test**

Run: `cd keeper-bot && node --loader ts-node/esm src/smart-dca-signal.test.ts`
Expected: `ALL PASS`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add keeper-bot/src/smart-dca-signal.ts keeper-bot/src/smart-dca-signal.test.ts
git commit -m "feat(keeper): CoinGecko sats/STX signal fetch with fail-open"
```

---

## Task 4: Wire the filter into the keeper run

**Files:**
- Modify: `keeper-bot/src/index.ts`

- [ ] **Step 1: Add imports near the top of `index.ts`** (after the existing imports, before the constants)

```typescript
import { readAllConfigs, readAllDefers, writeDefers } from "./smart-dca-store.js";
import { fetchSatsPerStxSignal } from "./smart-dca-signal.js";
import { decideBatch } from "./smart-dca.js";
```

- [ ] **Step 2: Insert the filter step in `runOnce()`** — immediately after the `const plans = await client.getExecutablePlansForBothVaults();` block and its `log.info("Plans ready to execute", ...)`, and BEFORE the `if (plans.length === 0)` early return, replace the plain `plans` usage with a gated list:

```typescript
  // ── Smart DCA: gate due vault-0 plans on the dip condition ──────────────
  // Fail-open: any error here leaves `executablePlans` = all due plans.
  let executablePlans = plans;
  try {
    const configs = await readAllConfigs();
    if (configs.size > 0) {
      const maxDays = Math.max(
        7,
        ...[...configs.values()].map((c) => c.windowDays)
      );
      const [defers, signal] = await Promise.all([
        readAllDefers(),
        fetchSatsPerStxSignal(maxDays),
      ]);
      const { toExecute, deferWrites } = decideBatch({
        plans,
        configs,
        deferByPlan: defers,
        signal,
      });
      await writeDefers(deferWrites).catch((err) =>
        log.warn("smart-dca writeDefers failed (non-fatal)", { err: String(err) })
      );
      const skipped = plans.length - toExecute.length;
      log.info("Smart DCA gating applied", {
        configured: configs.size,
        skipped,
        signal: signal ? signal.current.toFixed(2) : "fail-open",
      });
      executablePlans = toExecute;
    }
  } catch (err) {
    log.warn("smart-dca gating failed (non-fatal, failing open)", { err: String(err) });
  }

  if (executablePlans.length === 0) {
    log.info("Nothing to execute after Smart DCA gating, exiting");
    await markRun({ finishedAt: Date.now(), planCount: 0, chunkCount: 0, exitCode: 0 }).catch(() => {});
    return 0;
  }
```

Then update the existing chunking line to use the gated list:

```typescript
  // was: const chunks = chunkArray(plans, MAX_BATCH_SIZE);
  const chunks = chunkArray(executablePlans, MAX_BATCH_SIZE);
```

And update the original `if (plans.length === 0)` guard that came right after `getExecutablePlansForBothVaults` to remain as-is (it short-circuits when nothing is due at all). The new guard above handles "due but all deferred".

- [ ] **Step 3: Build the keeper to verify it compiles**

Run: `cd keeper-bot && npm run build`
Expected: TypeScript compiles with no errors.

- [ ] **Step 4: Re-run the pure suites to confirm nothing regressed**

Run: `cd keeper-bot && node --loader ts-node/esm src/smart-dca.test.ts && node --loader ts-node/esm src/smart-dca-signal.test.ts`
Expected: both `ALL PASS`.

- [ ] **Step 5: Commit**

```bash
git add keeper-bot/src/index.ts
git commit -m "feat(keeper): gate due vault-0 plans on Smart DCA dip condition"
```

---

## Task 5: Frontend shared types + validation (Vitest)

**Files:**
- Create: `src/lib/smart-dca.ts`
- Create: `src/lib/smart-dca.test.ts`

- [ ] **Step 1: Write the failing test `src/lib/smart-dca.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { validateConfigInput, premium, SMART_DCA_LIMITS } from "./smart-dca";

describe("validateConfigInput", () => {
  const ok = { planId: 1, thresholdBps: 500, windowDays: 7, maxDeferIntervals: 2 };

  it("accepts a valid config", () => {
    expect(validateConfigInput(ok)).toEqual({ ok: true, errors: [] });
  });
  it("rejects thresholdBps out of range", () => {
    const r = validateConfigInput({ ...ok, thresholdBps: 6000 });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("thresholdBps must be 0..5000");
  });
  it("rejects windowDays out of range", () => {
    expect(validateConfigInput({ ...ok, windowDays: 0 }).ok).toBe(false);
    expect(validateConfigInput({ ...ok, windowDays: 31 }).ok).toBe(false);
  });
  it("rejects maxDeferIntervals out of range", () => {
    expect(validateConfigInput({ ...ok, maxDeferIntervals: 11 }).ok).toBe(false);
  });
  it("rejects a non-integer planId", () => {
    expect(validateConfigInput({ ...ok, planId: 1.5 }).ok).toBe(false);
  });
});

describe("premium", () => {
  it("computes current/avg - 1", () => {
    expect(premium(106, 100)).toBeCloseTo(0.06, 9);
  });
  it("returns null when avg <= 0", () => {
    expect(premium(106, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/smart-dca.test.ts`
Expected: FAIL — module `./smart-dca` not found.

- [ ] **Step 3: Write `src/lib/smart-dca.ts`**

```typescript
// src/lib/smart-dca.ts
// Shared types + pure validation for the Smart DCA ("buy the dip") feature.
// Keeper has its own copy of the decision math; this is the frontend/API side.

export interface SmartDcaConfig {
  owner: string;
  thresholdBps: number;
  windowDays: number;
  maxDeferIntervals: number;
  createdAt: number;
}

export const SMART_DCA_LIMITS = {
  thresholdBps: { min: 0, max: 5000 },
  windowDays: { min: 1, max: 30 },
  maxDeferIntervals: { min: 0, max: 10 },
} as const;

export interface ConfigInput {
  planId: number;
  thresholdBps: number;
  windowDays: number;
  maxDeferIntervals: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateConfigInput(input: ConfigInput): ValidationResult {
  const errors: string[] = [];
  const { planId, thresholdBps, windowDays, maxDeferIntervals } = input;
  if (!Number.isInteger(planId) || planId < 0) errors.push("planId must be a non-negative integer");
  const t = SMART_DCA_LIMITS.thresholdBps;
  if (!(thresholdBps >= t.min && thresholdBps <= t.max)) errors.push("thresholdBps must be 0..5000");
  const w = SMART_DCA_LIMITS.windowDays;
  if (!Number.isInteger(windowDays) || windowDays < w.min || windowDays > w.max)
    errors.push("windowDays must be 1..30");
  const d = SMART_DCA_LIMITS.maxDeferIntervals;
  if (!Number.isInteger(maxDeferIntervals) || maxDeferIntervals < d.min || maxDeferIntervals > d.max)
    errors.push("maxDeferIntervals must be 0..10");
  return { ok: errors.length === 0, errors };
}

// current/avg - 1, or null when avg is non-positive.
export function premium(current: number, avg: number): number | null {
  if (!(avg > 0)) return null;
  return current / avg - 1;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/lib/smart-dca.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/smart-dca.ts src/lib/smart-dca.test.ts
git commit -m "feat(dca): shared Smart DCA types + validation"
```

---

## Task 6: Frontend Redis store for Smart DCA config

**Files:**
- Create: `src/lib/smart-dca-redis.ts`

- [ ] **Step 1: Write `src/lib/smart-dca-redis.ts` (mirrors `src/lib/push-redis.ts`)**

```typescript
// src/lib/smart-dca-redis.ts
// Server-only Redis IO for Smart DCA config. Mirrors push-redis.ts: returns
// null / no-ops when env is absent so routes degrade instead of throwing.
import { Redis } from "@upstash/redis";
import type { SmartDcaConfig } from "./smart-dca";

const CONFIG_HASH = "smart-dca:v0:config";
const DEFER_HASH = "smart-dca:v0:defer";

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (redis !== undefined) return redis;
  try { redis = Redis.fromEnv(); } catch { redis = null; }
  return redis;
}

function parse(raw: unknown): SmartDcaConfig | null {
  let obj: unknown = raw;
  if (typeof raw === "string") { try { obj = JSON.parse(raw); } catch { return null; } }
  if (!obj || typeof obj !== "object") return null;
  const c = obj as Record<string, unknown>;
  if (
    typeof c.owner !== "string" || typeof c.thresholdBps !== "number" ||
    typeof c.windowDays !== "number" || typeof c.maxDeferIntervals !== "number"
  ) return null;
  return {
    owner: c.owner,
    thresholdBps: c.thresholdBps,
    windowDays: c.windowDays,
    maxDeferIntervals: c.maxDeferIntervals,
    createdAt: typeof c.createdAt === "number" ? c.createdAt : 0,
  };
}

export interface SmartDcaConfigView extends SmartDcaConfig {
  planId: number;
}

export async function getConfigsForOwner(owner: string): Promise<SmartDcaConfigView[]> {
  const client = getRedis();
  if (!client) return [];
  const raw = await client.hgetall<Record<string, unknown>>(CONFIG_HASH);
  if (!raw) return [];
  const lower = owner.toLowerCase();
  const out: SmartDcaConfigView[] = [];
  for (const [field, v] of Object.entries(raw)) {
    const cfg = parse(v);
    const planId = Number(field);
    if (cfg && Number.isFinite(planId) && cfg.owner.toLowerCase() === lower) {
      out.push({ planId, ...cfg });
    }
  }
  return out;
}

export async function putConfig(planId: number, cfg: SmartDcaConfig): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.hset(CONFIG_HASH, { [String(planId)]: JSON.stringify(cfg) });
}

// Removing a config also clears its defer counter so a future re-enable starts clean.
export async function deleteConfig(planId: number): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.hdel(CONFIG_HASH, String(planId));
  await client.hdel(DEFER_HASH, String(planId));
}

// Ownership guard for mutations: returns the stored config for a plan, or null.
export async function getConfig(planId: number): Promise<SmartDcaConfig | null> {
  const client = getRedis();
  if (!client) return null;
  const raw = await client.hget<unknown>(CONFIG_HASH, String(planId));
  return parse(raw ?? null);
}
```

- [ ] **Step 2: Type-check via build**

Run: `npm run build`
Expected: compiles (route consumers come in Task 7; this is a leaf module so the build should pass).

- [ ] **Step 3: Commit**

```bash
git add src/lib/smart-dca-redis.ts
git commit -m "feat(dca): server-only Redis store for Smart DCA config"
```

---

## Task 7: API routes (config CRUD + signal)

**Files:**
- Create: `src/app/api/dca/smart/route.ts`
- Create: `src/app/api/dca/smart/signal/route.ts`

- [ ] **Step 1: Write `src/app/api/dca/smart/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateConfigInput, type SmartDcaConfig } from "@/lib/smart-dca";
import {
  getConfigsForOwner, getConfig, putConfig, deleteConfig,
} from "@/lib/smart-dca-redis";

export const dynamic = "force-dynamic";

// GET /api/dca/smart?address=SP... → that owner's configs
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!address) return NextResponse.json({ configs: [] });
  try {
    const configs = await getConfigsForOwner(address);
    return NextResponse.json({ configs }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ configs: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}

// POST /api/dca/smart  { address, planId, thresholdBps, windowDays, maxDeferIntervals }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const address = String(body.address ?? "").trim();
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  const input = {
    planId: Number(body.planId),
    thresholdBps: Number(body.thresholdBps),
    windowDays: Number(body.windowDays),
    maxDeferIntervals: Number(body.maxDeferIntervals),
  };
  const v = validateConfigInput(input);
  if (!v.ok) return NextResponse.json({ error: "invalid", details: v.errors }, { status: 400 });

  // Ownership guard: if a config already exists for this plan, only its owner may edit it.
  const existing = await getConfig(input.planId);
  if (existing && existing.owner.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json({ error: "not owner" }, { status: 403 });
  }

  const cfg: SmartDcaConfig = {
    owner: address,
    thresholdBps: input.thresholdBps,
    windowDays: input.windowDays,
    maxDeferIntervals: input.maxDeferIntervals,
    createdAt: existing?.createdAt ?? Math.floor(Date.now() / 1000),
  };
  await putConfig(input.planId, cfg);
  return NextResponse.json({ ok: true, config: { planId: input.planId, ...cfg } });
}

// DELETE /api/dca/smart  { address, planId }
export async function DELETE(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const address = String(body.address ?? "").trim();
  const planId = Number(body.planId);
  if (!address || !Number.isInteger(planId)) {
    return NextResponse.json({ error: "address and integer planId required" }, { status: 400 });
  }
  const existing = await getConfig(planId);
  if (existing && existing.owner.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json({ error: "not owner" }, { status: 403 });
  }
  await deleteConfig(planId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write `src/app/api/dca/smart/signal/route.ts`**

This computes the live premium for the UI from CoinGecko daily charts (same source as the keeper). Reuses the frontend `premium` helper.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { premium } from "@/lib/smart-dca";

export const dynamic = "force-dynamic";

const CG = "https://api.coingecko.com/api/v3";

async function dailyUsd(coin: string, days: number): Promise<number[]> {
  const res = await fetch(
    `${CG}/coins/${coin}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    { signal: AbortSignal.timeout(10_000), next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error(`coingecko ${coin} ${res.status}`);
  const data = (await res.json()) as { prices: [number, number][] };
  return (data.prices ?? []).map(([, v]) => v);
}

// GET /api/dca/smart/signal?windowDays=7
export async function GET(req: NextRequest) {
  const windowDays = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get("windowDays") ?? 7) || 7, 30));
  try {
    const [stx, btc] = await Promise.all([dailyUsd("blockstack", windowDays), dailyUsd("bitcoin", windowDays)]);
    const n = Math.min(stx.length, btc.length);
    const series: number[] = [];
    for (let i = 0; i < n; i++) if (btc[i] > 0) series.push((stx[i] / btc[i]) * 1e8);
    if (series.length === 0) return NextResponse.json({ signal: null });
    const current = series[series.length - 1];
    const avg = series.reduce((a, v) => a + v, 0) / series.length;
    return NextResponse.json(
      { signal: { current, sma: avg, premium: premium(current, avg) } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ signal: null });
  }
}
```

- [ ] **Step 3: Build to verify both routes compile**

Run: `npm run build`
Expected: compiles; routes appear in the build output under `/api/dca/smart` and `/api/dca/smart/signal`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/dca/smart/route.ts src/app/api/dca/smart/signal/route.ts
git commit -m "feat(dca): Smart DCA config CRUD + live signal API routes"
```

---

## Task 8: Frontend store, hook, and UI panel

**Files:**
- Create: `src/store/smartDcaStore.ts`
- Create: `src/hooks/useSmartDca.ts`
- Create: `src/components/dca/SmartDcaPanel.tsx`

> Match the styling/classes of an existing DCA component (e.g. the plan card under `src/components/dca/`). The code below is functional and uses theme tokens; adjust class names to match the sibling components you see in that directory.

- [ ] **Step 1: Write `src/store/smartDcaStore.ts`**

```typescript
import { create } from "zustand";
import type { SmartDcaConfigView } from "@/lib/smart-dca-redis";

interface SmartDcaState {
  configs: Record<number, SmartDcaConfigView>; // keyed by planId
  setAll: (list: SmartDcaConfigView[]) => void;
  upsert: (cfg: SmartDcaConfigView) => void;
  remove: (planId: number) => void;
}

export const useSmartDcaStore = create<SmartDcaState>((set) => ({
  configs: {},
  setAll: (list) =>
    set({ configs: Object.fromEntries(list.map((c) => [c.planId, c])) }),
  upsert: (cfg) => set((s) => ({ configs: { ...s.configs, [cfg.planId]: cfg } })),
  remove: (planId) =>
    set((s) => {
      const next = { ...s.configs };
      delete next[planId];
      return { configs: next };
    }),
}));
```

- [ ] **Step 2: Write `src/hooks/useSmartDca.ts`**

```typescript
"use client";
import useSWR from "swr";
import { useEffect } from "react";
import { useSmartDcaStore } from "@/store/smartDcaStore";
import type { SmartDcaConfigView } from "@/lib/smart-dca-redis";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Hydrate the store from the server for a connected wallet.
export function useSmartDcaHydration(address: string | null) {
  const setAll = useSmartDcaStore((s) => s.setAll);
  const { data } = useSWR<{ configs: SmartDcaConfigView[] }>(
    address ? `/api/dca/smart?address=${address}` : null,
    fetcher,
    { refreshInterval: 30_000 }
  );
  useEffect(() => {
    if (data?.configs) setAll(data.configs);
  }, [data, setAll]);
}

export async function saveSmartDca(input: {
  address: string; planId: number; thresholdBps: number; windowDays: number; maxDeferIntervals: number;
}): Promise<{ ok: boolean; details?: string[] }> {
  const res = await fetch("/api/dca/smart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (res.ok) {
    useSmartDcaStore.getState().upsert(json.config);
    return { ok: true };
  }
  return { ok: false, details: json.details };
}

export async function removeSmartDca(address: string, planId: number): Promise<void> {
  const res = await fetch("/api/dca/smart", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, planId }),
  });
  if (res.ok) useSmartDcaStore.getState().remove(planId);
}

// Live signal for the status line.
export function useSmartDcaSignal(windowDays: number, enabled: boolean) {
  const { data } = useSWR<{ signal: { current: number; sma: number; premium: number | null } | null }>(
    enabled ? `/api/dca/smart/signal?windowDays=${windowDays}` : null,
    fetcher,
    { refreshInterval: 60_000 }
  );
  return data?.signal ?? null;
}
```

- [ ] **Step 3: Write `src/components/dca/SmartDcaPanel.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useSmartDcaStore } from "@/store/smartDcaStore";
import { saveSmartDca, removeSmartDca, useSmartDcaSignal } from "@/hooks/useSmartDca";

interface Props {
  planId: number;
  address: string;
  vaultType: 0 | 1; // only vault 0 supports Smart DCA in v1
}

export function SmartDcaPanel({ planId, address, vaultType }: Props) {
  const cfg = useSmartDcaStore((s) => s.configs[planId]);
  const enabled = !!cfg;
  const [thresholdPct, setThresholdPct] = useState(cfg ? cfg.thresholdBps / 100 : 5);
  const [windowDays, setWindowDays] = useState(cfg?.windowDays ?? 7);
  const [maxDefer, setMaxDefer] = useState(cfg?.maxDeferIntervals ?? 2);
  const [error, setError] = useState<string | null>(null);

  const signal = useSmartDcaSignal(windowDays, enabled);

  if (vaultType !== 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Smart DCA (buy the dip) is available on STX→sBTC plans.
      </p>
    );
  }

  async function onSave() {
    setError(null);
    const r = await saveSmartDca({
      address, planId,
      thresholdBps: Math.round(thresholdPct * 100),
      windowDays, maxDeferIntervals: maxDefer,
    });
    if (!r.ok) setError(r.details?.join(", ") ?? "Save failed");
  }

  const pct = signal?.premium != null ? (signal.premium * 100).toFixed(1) : null;
  const need = thresholdPct.toFixed(1);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">Smart DCA — buy the dip</span>
        {enabled && (
          <button className="text-sm text-red-500" onClick={() => removeSmartDca(address, planId)}>
            Turn off
          </button>
        )}
      </div>

      <label className="block text-sm">
        Buy only when 1 STX gets ≥ this % more sats than the {windowDays}-day average
        <input
          type="number" min={0} max={50} step={0.5} value={thresholdPct}
          onChange={(e) => setThresholdPct(Number(e.target.value))}
          className="ml-2 w-20 rounded border px-2 py-1"
        />
      </label>

      <label className="block text-sm">
        Average window (days)
        <input
          type="number" min={1} max={30} value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="ml-2 w-20 rounded border px-2 py-1"
        />
      </label>

      <label className="block text-sm">
        Max checks to skip before buying at market
        <input
          type="number" min={0} max={10} value={maxDefer}
          onChange={(e) => setMaxDefer(Number(e.target.value))}
          className="ml-2 w-20 rounded border px-2 py-1"
        />
      </label>

      {enabled && pct != null && (
        <p className="text-sm text-muted-foreground">
          Now: {pct}% vs average — need ≥ {need}%.
          {Number(pct) >= Number(need) ? " Dip condition met." : " Waiting for a better entry."}
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={onSave}>
        {enabled ? "Update" : "Enable Smart DCA"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Mount hydration** — in `src/app/layout-client.tsx` (where `useAlertsHydration` is mounted per CLAUDE.md), add the Smart DCA hydration alongside it:

```tsx
// near the other hydration hooks:
import { useSmartDcaHydration } from "@/hooks/useSmartDca";
// inside the component body, using the same wallet address source as useAlertsHydration:
useSmartDcaHydration(address);
```

(If the existing hydration uses a different address variable name, reuse that exact one.)

- [ ] **Step 5: Render the panel** — add `<SmartDcaPanel planId={plan.id} address={address} vaultType={vaultType} />` inside the existing DCA plan detail/edit view under `src/components/dca/`. Use the same `plan.id`, wallet `address`, and the plan's vault type already available in that component.

- [ ] **Step 6: Build + lint**

Run: `npm run build && npm run lint`
Expected: compiles, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/store/smartDcaStore.ts src/hooks/useSmartDca.ts src/components/dca/SmartDcaPanel.tsx src/app/layout-client.tsx
git commit -m "feat(dca): Smart DCA store, hook, and config panel UI"
```

---

## Task 9: Tag the execution push as a dip buy (optional polish)

**Files:**
- Modify: `keeper-bot/src/dca-push.ts`
- Modify: `keeper-bot/src/index.ts`

This is a minimal enhancement: when a vault-0 plan executed because the dip condition was met (`reason === "dip-hit"`), the push body says so. Because `decideBatch` currently returns only `toExecute`/`deferWrites`, extend it to also surface the per-plan reason.

- [ ] **Step 1: Extend `decideBatch` return in `keeper-bot/src/smart-dca.ts`** to include reasons, and update its test:

In `smart-dca.ts`, change the return type to add `reasons: Map<number, string>` and populate `reasons.set(plan.planId, decision.reason)` inside the loop (only for gated plans).

```typescript
// return shape becomes:
//   { toExecute: BatchPlan[]; deferWrites: Map<number, number>; reasons: Map<number, string> }
```

In `smart-dca.test.ts`, add one assertion after the existing `decideBatch` block:

```typescript
assert(r.reasons.get(1) === "below-threshold", "decideBatch surfaces per-plan reason");
```

- [ ] **Step 2: Run the keeper pure suite**

Run: `cd keeper-bot && node --loader ts-node/esm src/smart-dca.test.ts`
Expected: `ALL PASS`.

- [ ] **Step 3: Thread the reason into the push** — in `index.ts`, capture `reasons` from `decideBatch` and pass a `Set<number>` of "dip-hit" plan ids into `sendDcaExecutionNotifications`. In `dca-push.ts`, add an optional 4th param `dipPlanIds?: Set<number>` and, when building `planLabel`/`body`, append " (bought the dip)" if any executed plan id is in the set.

```typescript
// dca-push.ts signature change:
export async function sendDcaExecutionNotifications(
  executedPlans: BatchPlan[],
  txid: string,
  allSubs: Record<string, SubEntry>,
  dipPlanIds?: Set<number>,
): Promise<void> {
  // ...inside the per-wallet loop, after computing planIds:
  const boughtDip = !!dipPlanIds && planIds.some((id) => dipPlanIds.has(id));
  const body = boughtDip
    ? `${planLabel} executed on a dip ✓ Tap to view details.`
    : `${planLabel} executed successfully. Tap to view details.`;
  // use `body` in the payload instead of the inline string
}
```

In `index.ts`, build the set from `reasons` (`new Set([...reasons].filter(([,r]) => r === "dip-hit").map(([id]) => id))`) and pass it to `sendDcaExecutionNotifications(chunk, result.txid, allSubs, dipPlanIds)`.

- [ ] **Step 4: Build the keeper**

Run: `cd keeper-bot && npm run build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add keeper-bot/src/smart-dca.ts keeper-bot/src/smart-dca.test.ts keeper-bot/src/dca-push.ts keeper-bot/src/index.ts
git commit -m "feat(keeper): mark dip-hit executions in the DCA push notification"
```

---

## Task 10: Full verification

- [ ] **Step 1: Frontend unit suite**

Run: `npm test`
Expected: all pass, including the new `src/lib/smart-dca.test.ts` (count = prior 154 + 7 new ≈ 161). Record the exact count.

- [ ] **Step 2: Keeper suites**

Run: `cd keeper-bot && node --loader ts-node/esm src/smart-dca.test.ts && node --loader ts-node/esm src/smart-dca-signal.test.ts`
Expected: both `ALL PASS`.

- [ ] **Step 3: Builds + lint**

Run: `npm run build && npm run lint && cd keeper-bot && npm run build`
Expected: all succeed.

- [ ] **Step 4: Manual smoke (optional, requires Redis env)**

Start the dev server, connect a wallet, enable Smart DCA on a STX→sBTC plan with threshold 5% / window 7 / max-defer 2, confirm the status line renders and `GET /api/dca/smart?address=…` returns the config.

---

## Self-review notes

- **Spec coverage:** §1 invariants → Tasks 1/4 (additive gating, fail-open). §2 data model → Tasks 2/6. §3 auth-by-address + ownership guard → Task 7. §4 keeper logic (signal, per-plan SMA, defer cap, counter reset, fail-open) → Tasks 1/3/4. §4 caveat (defer = keeper runs) → reflected in UI copy "checks" (Task 8). §5 API + UI + store → Tasks 7/8; notification dip flag → Task 9. §6 validation ranges + tests + non-goals → Tasks 5/1/3 tests; vault-1 excluded in `decideBatch` and the UI panel.
- **No production logic in the swap path changes** — only plan *selection* is gated; the contract calls are untouched.
- **Type consistency:** `SmartDcaConfig` fields (`owner/thresholdBps/windowDays/maxDeferIntervals/createdAt`) are identical across keeper (`smart-dca.ts`) and frontend (`smart-dca.ts`); the small duplication is intentional and documented in the spec. `decideBatch` return shape is extended once (Task 9) and its test updated in the same task.
- **Defer persistence tradeoff:** defer writes happen at decision time, before broadcast; if a broadcast later fails, a reset-to-0 plan simply re-evaluates next run from 0. Documented in spec §4.
