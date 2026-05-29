# DCA Pure-Function Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add characterization unit tests for the 12 untested pure functions in `src/lib/dca.ts` and `src/lib/dca-sbtc.ts` (DCA money-path), locking current behavior and flagging — not fixing — suspicious behavior.

**Architecture:** Colocated Vitest test files matching house style (`describe/it`, hand-derived expected values, `ev()` fixture builders). Characterization only: zero production logic changes. A final task collects all suspicious findings into a watchlist report.

**Tech Stack:** Vitest 2.x (`import { describe, it, expect } from "vitest"`, no globals). Float comparisons use `toBeCloseTo`.

---

## Characterization workflow (read before starting)

These functions already exist and already behave. So unlike new-code TDD, a
correctly hand-derived test **passes on first run**. The "verify" step is:

- **PASS** → behavior is now locked. Good.
- **FAIL** → the hand-derived expectation disagrees with the implementation.
  Decide which:
  1. **My expectation was wrong** → fix the expected value in the test.
  2. **It's a money-path bug** (NaN, lost funds, wrong sign) → keep a test that
     asserts the *actual* current output, add a `// CHARACTERIZED: <concern>`
     comment above it, and record the finding in Task 7's watchlist. **Do not
     change `src/lib/*.ts`.**

## File Structure

- **Create:** `src/lib/dca.test.ts` — covers all pure functions exported from `dca.ts`. Built up across Tasks 1–5 (each task appends one `describe` block + commits).
- **Modify:** `src/lib/dca-sbtc.test.ts` — append `describe` blocks for `blocksToInterval`, `satsToBTC`, `btcToSats` (Task 6). Keep the existing 5 tests untouched.
- **Create:** `docs/superpowers/findings/2026-05-29-dca-pure-function-watchlist.md` — bug watchlist report (Task 7).

Run all tests with: `npm test` (alias for `vitest run`). Run one file: `npx vitest run src/lib/dca.test.ts`.

---

### Task 1: Conversion helpers (`microToToken`, `tokenToMicro`, `microToSTX`, `stxToMicro`)

**Files:**
- Create: `src/lib/dca.test.ts`
- Test target: `src/lib/dca.ts:76-86`

- [ ] **Step 1: Write the test file with the conversions block**

```typescript
import { describe, it, expect } from "vitest";
import {
  microToToken,
  tokenToMicro,
  microToSTX,
  stxToMicro,
} from "./dca";

describe("microToToken", () => {
  it("converts micro to token at default 6 decimals", () => {
    expect(microToToken(1_500_000)).toBe(1.5);
  });
  it("honors an explicit decimals argument (8dp)", () => {
    expect(microToToken(150_000_000, 8)).toBe(1.5);
  });
  it("returns 0 for 0", () => {
    expect(microToToken(0)).toBe(0);
  });
  it("represents a single micro-unit at 6dp", () => {
    expect(microToToken(1)).toBeCloseTo(0.000001, 12);
  });
});

describe("tokenToMicro", () => {
  it("converts token to micro at default 6 decimals", () => {
    expect(tokenToMicro(1.5)).toBe(1_500_000);
  });
  it("honors an explicit decimals argument (8dp)", () => {
    expect(tokenToMicro(1.5, 8)).toBe(150_000_000);
  });
  // CHARACTERIZED: Math.floor drops sub-micro dust (0.0000005 STX -> 0).
  it("floors sub-micro amounts to zero (dust loss)", () => {
    expect(tokenToMicro(0.0000005)).toBe(0);
  });
  it("round-trips with microToToken", () => {
    expect(microToToken(tokenToMicro(2.5))).toBe(2.5);
  });
});

describe("microToSTX / stxToMicro", () => {
  it("microToSTX converts at 6 decimals", () => {
    expect(microToSTX(2_000_000)).toBe(2);
  });
  it("stxToMicro converts at 6 decimals", () => {
    expect(stxToMicro(2)).toBe(2_000_000);
  });
  it("round-trips", () => {
    expect(microToSTX(stxToMicro(3.25))).toBe(3.25);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/lib/dca.test.ts`
Expected: PASS (10 tests). If any FAIL, apply the characterization workflow above.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dca.test.ts
git commit -m "test(dca): characterize micro/token conversion helpers"
```

---

### Task 2: `blocksToInterval` and `utcIsoDateFromUnix`

**Files:**
- Modify: `src/lib/dca.test.ts` (append)
- Test target: `src/lib/dca.ts:57-74` and `src/lib/dca.ts:497-503`

- [ ] **Step 1: Add imports** — extend the import from `./dca` to include `blocksToInterval` and `utcIsoDateFromUnix`:

```typescript
import {
  microToToken,
  tokenToMicro,
  microToSTX,
  stxToMicro,
  blocksToInterval,
  utcIsoDateFromUnix,
} from "./dca";
```

- [ ] **Step 2: Append the describe blocks**

```typescript
describe("blocksToInterval", () => {
  it.each([
    [650, "Daily"],
    [4550, "Weekly"],
    [19500, "Monthly"],
    [1300, "Daily (v2)"],
    [9100, "Weekly (v2)"],
    [39000, "Monthly (v2)"],
    [9360, "Daily (legacy)"],
    [65520, "Weekly (legacy)"],
    [280800, "Monthly (legacy)"],
    [144, "Daily (v1)"],
    [1008, "Weekly (v1)"],
    [4320, "Monthly (v1)"],
  ])("maps %i blocks to %s", (blocks, label) => {
    expect(blocksToInterval(blocks)).toBe(label);
  });
  it("falls back to '<n> blocks' for unknown values", () => {
    expect(blocksToInterval(999)).toBe("999 blocks");
  });
  it("formats zero as '0 blocks'", () => {
    expect(blocksToInterval(0)).toBe("0 blocks");
  });
});

describe("utcIsoDateFromUnix", () => {
  it("formats the unix epoch as 1970-01-01", () => {
    expect(utcIsoDateFromUnix(0)).toBe("1970-01-01");
  });
  it("formats a known timestamp in UTC", () => {
    // 1700000000 = 2023-11-14T22:13:20Z
    expect(utcIsoDateFromUnix(1700000000)).toBe("2023-11-14");
  });
  it("zero-pads single-digit month and day", () => {
    // 1704067200 = 2024-01-01T00:00:00Z
    expect(utcIsoDateFromUnix(1704067200)).toBe("2024-01-01");
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/lib/dca.test.ts`
Expected: PASS (existing 10 + 17 new). If any FAIL, apply the characterization workflow.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dca.test.ts
git commit -m "test(dca): characterize blocksToInterval and utcIsoDateFromUnix"
```

---

### Task 3: `computeLumpSum`

**Files:**
- Modify: `src/lib/dca.test.ts` (append)
- Test target: `src/lib/dca.ts:513-533`

- [ ] **Step 1: Add `computeLumpSum` to the `./dca` import.**

- [ ] **Step 2: Append the describe block**

```typescript
describe("computeLumpSum", () => {
  const perf = { totalStxIn: 100, totalSbtcOut: 0.01 };

  it("computes the lump-sum counterfactual and delta", () => {
    const r = computeLumpSum(perf, "2024-01-01", 2, 50000);
    expect(r).not.toBeNull();
    // usdAvailable = 100 * 2 = 200; lumpSumSbtc = 200 / 50000 = 0.004
    expect(r!.lumpSumSbtc).toBeCloseTo(0.004, 9);
    // deltaSbtc = 0.01 - 0.004 = 0.006
    expect(r!.deltaSbtc).toBeCloseTo(0.006, 9);
    // deltaPct = (0.006 / 0.004) * 100 = 150
    expect(r!.deltaPct).toBeCloseTo(150, 6);
    expect(r!.referenceDate).toBe("2024-01-01");
    expect(r!.stxUsdAtRef).toBe(2);
    expect(r!.btcUsdAtRef).toBe(50000);
  });

  it("returns null when stxUsdAtRef <= 0", () => {
    expect(computeLumpSum(perf, "2024-01-01", 0, 50000)).toBeNull();
  });
  it("returns null when btcUsdAtRef <= 0", () => {
    expect(computeLumpSum(perf, "2024-01-01", 2, 0)).toBeNull();
  });
  it("returns null when totalStxIn <= 0", () => {
    expect(
      computeLumpSum({ totalStxIn: 0, totalSbtcOut: 0.01 }, "2024-01-01", 2, 50000)
    ).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/lib/dca.test.ts`
Expected: PASS. Apply the characterization workflow on any FAIL.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dca.test.ts
git commit -m "test(dca): characterize computeLumpSum counterfactual + guards"
```

---

### Task 4: `aggregatePlanPerformance`

**Files:**
- Modify: `src/lib/dca.test.ts` (append)
- Test target: `src/lib/dca.ts:555-587`; event shape `PlanExecutionEvent` at `src/lib/dca.ts:327`

- [ ] **Step 1: Add `aggregatePlanPerformance` and `type PlanExecutionEvent` to the `./dca` import.** `import { ..., aggregatePlanPerformance, type PlanExecutionEvent } from "./dca";`

- [ ] **Step 2: Append the describe block with an `ev()` fixture builder** (mirrors the pattern in `dca-sbtc.test.ts`)

```typescript
function ev(partial: Partial<PlanExecutionEvent>): PlanExecutionEvent {
  return {
    txId: "0xabc",
    blockHeight: 1,
    blockTime: 1_700_000_000,
    status: "success",
    netSwapped: 10_000_000,   // 10 STX in micro-STX
    protocolFee: 100_000,     // 0.1 STX
    sbtcReceived: 20_000,     // sats
    ...partial,
  };
}

describe("aggregatePlanPerformance", () => {
  it("returns zeros and null timestamps when there are no events", () => {
    const r = aggregatePlanPerformance(1, []);
    expect(r).toEqual({
      planId: 1,
      executionCount: 0,
      totalStxIn: 0,
      totalSbtcOut: 0,
      avgStxPerSbtc: 0,
      totalFeeStx: 0,
      firstExecutionAt: null,
      lastExecutionAt: null,
      successfulEvents: [],
    });
  });

  it("ignores non-success events and events missing sbtc/netSwapped", () => {
    const events = [
      ev({ status: "failed", blockTime: 50 }),
      ev({ status: "success", sbtcReceived: 0, blockTime: 60 }),
      ev({ status: "success", netSwapped: undefined, blockTime: 70 }),
      ev({ status: "success", blockTime: 100, netSwapped: 5_000_000, sbtcReceived: 10_000, protocolFee: 50_000 }),
    ];
    const r = aggregatePlanPerformance(7, events);
    expect(r.executionCount).toBe(1);
    expect(r.successfulEvents).toHaveLength(1);
    expect(r.successfulEvents[0].blockTime).toBe(100);
  });

  it("sums, sorts ascending by blockTime, and converts units", () => {
    const events = [
      ev({ blockTime: 200, netSwapped: 10_000_000, sbtcReceived: 20_000, protocolFee: 100_000 }),
      ev({ blockTime: 100, netSwapped: 5_000_000, sbtcReceived: 10_000, protocolFee: 50_000 }),
    ];
    const r = aggregatePlanPerformance(3, events);
    expect(r.executionCount).toBe(2);
    // 15_000_000 micro-STX -> 15 STX
    expect(r.totalStxIn).toBeCloseTo(15, 9);
    // 30_000 sats -> 0.0003 sBTC
    expect(r.totalSbtcOut).toBeCloseTo(0.0003, 9);
    // 150_000 micro-STX fee -> 0.15 STX
    expect(r.totalFeeStx).toBeCloseTo(0.15, 9);
    // 15 / 0.0003 = 50000
    expect(r.avgStxPerSbtc).toBeCloseTo(50000, 3);
    expect(r.firstExecutionAt).toBe(100);
    expect(r.lastExecutionAt).toBe(200);
    expect(r.successfulEvents.map((e) => e.blockTime)).toEqual([100, 200]);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/lib/dca.test.ts`
Expected: PASS. Apply the characterization workflow on any FAIL.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dca.test.ts
git commit -m "test(dca): characterize aggregatePlanPerformance cost-basis math"
```

---

### Task 5: `batchedMap`

**Files:**
- Modify: `src/lib/dca.test.ts` (append)
- Test target: `src/lib/dca.ts:34-45`

- [ ] **Step 1: Add `batchedMap` to the `./dca` import.**

- [ ] **Step 2: Append the describe block**

```typescript
describe("batchedMap", () => {
  it("preserves input order in the output", async () => {
    const out = await batchedMap([1, 2, 3, 4, 5], async (x) => x * 2, 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it("returns an empty array for empty input", async () => {
    const out = await batchedMap([], async (x: number) => x);
    expect(out).toEqual([]);
  });

  it("caps concurrency at the given limit", async () => {
    let active = 0;
    let maxActive = 0;
    const fn = async (x: number) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return x;
    };
    await batchedMap([1, 2, 3, 4, 5], fn, 2);
    expect(maxActive).toBe(2);
  });

  it("defaults concurrency to 3", async () => {
    let active = 0;
    let maxActive = 0;
    const fn = async (x: number) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return x;
    };
    await batchedMap([1, 2, 3, 4], fn);
    expect(maxActive).toBe(3);
  });

  it("propagates a rejection from the mapper", async () => {
    const fn = async (x: number) => {
      if (x === 3) throw new Error("boom");
      return x;
    };
    await expect(batchedMap([1, 2, 3, 4], fn, 2)).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/lib/dca.test.ts`
Expected: PASS. Apply the characterization workflow on any FAIL.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dca.test.ts
git commit -m "test(dca): characterize batchedMap ordering and concurrency"
```

---

### Task 6: `dca-sbtc.ts` pure functions (`blocksToInterval`, `satsToBTC`, `btcToSats`)

**Files:**
- Modify: `src/lib/dca-sbtc.test.ts` (append; keep existing 5 tests)
- Test target: `src/lib/dca-sbtc.ts:40-65`

- [ ] **Step 1: Extend the existing `./dca-sbtc` import** to add the three functions:

```typescript
import {
  aggregateSBTCPlanPerformance,
  blocksToInterval,
  satsToBTC,
  btcToSats,
  type SBTCPlanExecutionEvent,
} from "./dca-sbtc";
```

- [ ] **Step 2: Append the describe blocks** (below the existing `aggregateSBTCPlanPerformance` block)

```typescript
describe("blocksToInterval (sBTC)", () => {
  it.each([
    [650, "Daily"],
    [4550, "Weekly"],
    [19500, "Monthly"],
    [1300, "Daily (v2)"],
    [9100, "Weekly (v2)"],
    [39000, "Monthly (v2)"],
    [9360, "Daily (legacy)"],
    [65520, "Weekly (legacy)"],
    [280800, "Monthly (legacy)"],
    [144, "Daily (v1)"],
    [1008, "Weekly (v1)"],
    [4320, "Monthly (v1)"],
  ])("maps %i blocks to %s", (blocks, label) => {
    expect(blocksToInterval(blocks)).toBe(label);
  });
  it("falls back to '<n> blocks' for unknown values", () => {
    expect(blocksToInterval(999)).toBe("999 blocks");
  });
});

describe("satsToBTC", () => {
  it("converts sats to BTC at 8 decimals", () => {
    expect(satsToBTC(150_000_000)).toBe(1.5);
  });
  it("returns 0 for 0", () => {
    expect(satsToBTC(0)).toBe(0);
  });
});

describe("btcToSats", () => {
  it("converts BTC to sats at 8 decimals", () => {
    expect(btcToSats(1.5)).toBe(150_000_000);
  });
  // CHARACTERIZED: Math.floor drops sub-sat dust (5e-9 BTC -> 0).
  it("floors sub-sat amounts to zero (dust loss)", () => {
    expect(btcToSats(0.000000005)).toBe(0);
  });
  it("round-trips with satsToBTC", () => {
    expect(satsToBTC(btcToSats(2.5))).toBe(2.5);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/lib/dca-sbtc.test.ts`
Expected: PASS (existing 5 + 17 new). Apply the characterization workflow on any FAIL.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dca-sbtc.test.ts
git commit -m "test(dca-sbtc): characterize blocksToInterval, satsToBTC, btcToSats"
```

---

### Task 7: Bug watchlist report + full-suite verification

**Files:**
- Create: `docs/superpowers/findings/2026-05-29-dca-pure-function-watchlist.md`

- [ ] **Step 1: Run the full unit suite**

Run: `npm test`
Expected: PASS, total = 96 (pre-existing) + new (≈ 44 added). Record the exact count.

- [ ] **Step 2: Write the watchlist report** with the confirmed findings (and anything new surfaced during Tasks 1–6 via the characterization workflow)

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/findings/2026-05-29-dca-pure-function-watchlist.md
git commit -m "docs(dca): watchlist of suspicious pure-function behaviors"
```

---

## Self-review notes

- **Spec coverage:** all 12 functions from the spec have a task (T1: 4 conversions; T2: blocksToInterval + utcIsoDateFromUnix; T3: computeLumpSum; T4: aggregatePlanPerformance; T5: batchedMap; T6: sBTC blocksToInterval + satsToBTC + btcToSats). Watchlist (3 items) → T7.
- **No production logic changes** in any task — characterization only.
- **Import consistency:** every task that uses a symbol adds it to the `./dca` or `./dca-sbtc` import; `ev()` builder defined in T4 (dca) mirrors the existing one in `dca-sbtc.test.ts`.
- **Float comparisons** use `toBeCloseTo` throughout.
