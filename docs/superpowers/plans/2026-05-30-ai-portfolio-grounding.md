# AI Portfolio Grounding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personalized "Your Position" section to the `/ai` tab that surfaces actionable alerts grounded in the connected wallet's real DCA plans, holdings, and PnL.

**Architecture:** Deterministic detectors compute factual signals (with real numbers) from the portfolio + market snapshots; the LLM only selects, prioritizes, and phrases them, with a deterministic template fallback when Groq is unavailable. A new per-address endpoint + Redis cache keeps this fully separate from the existing global `/api/ai/insights`.

**Tech Stack:** Next.js 15 route handlers, `groq-sdk`, `zod`, `@upstash/redis`, SWR, React.

**Spec:** [docs/superpowers/specs/2026-05-30-ai-portfolio-grounding-design.md](../specs/2026-05-30-ai-portfolio-grounding-design.md)

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/lib/ai-portfolio.ts` | Create | Client-safe types (`PersonalAlert`, `PortfolioInsightsResponse`) + `fetchPortfolioInsights()` |
| `src/lib/server/portfolio-signals.ts` | Create | Pure `detectSignals(input)` → `PortfolioSignal[]` |
| `src/lib/server/portfolio-signals.test.ts` | Create | Detector unit tests |
| `src/lib/server/personal-alerts-schema.ts` | Create | Zod validation of LLM output |
| `src/lib/server/personal-alerts-schema.test.ts` | Create | Schema tests |
| `src/lib/server/personal-alerts.ts` | Create | `templateAlerts()` (fallback) + `generatePersonalAlerts()` (Groq + fallback) |
| `src/lib/server/personal-alerts.test.ts` | Create | Template fallback tests |
| `src/lib/server/ai-insights-cache.ts` | Modify | Add per-address cache + rate-limit + delete helpers |
| `src/app/api/ai/portfolio-insights/route.ts` | Create | Orchestrate snapshot → detect → phrase → cache |
| `src/app/api/portfolio/invalidate/route.ts` | Modify | Also bust the per-address AI cache key |
| `src/hooks/usePortfolioInsights.ts` | Create | SWR hook, fetch only when address present |
| `src/components/ai/YourPositionCard.tsx` | Create | Render personalized alerts |
| `src/components/ai/AIPageContent.tsx` | Modify | Render "Your Position" section when connected |

---

## Task 1: Client-safe types

**Files:**
- Create: `src/lib/ai-portfolio.ts`

- [ ] **Step 1: Write the types + fetch helper**

```ts
// src/lib/ai-portfolio.ts
// Client-safe types + fetcher for the personalized "Your Position" alerts.
// Mirrors src/lib/ai.ts (the global insights equivalent).

export interface PersonalAlert {
  title: string;
  description: string;
  type: "opportunity" | "warning" | "info";
  priority: "high" | "medium" | "low";
}

export interface PortfolioInsightsResponse {
  generatedAt: string;
  alerts: PersonalAlert[]; // [] when there are no signals
}

export async function fetchPortfolioInsights(
  address: string
): Promise<PortfolioInsightsResponse> {
  const res = await fetch(
    `/api/ai/portfolio-insights?address=${encodeURIComponent(address)}`
  );
  if (!res.ok) throw new Error("Failed to fetch portfolio insights");
  return res.json();
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next" | head`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai-portfolio.ts
git commit -m "feat(ai): client-safe types for personalized portfolio alerts"
```

---

## Task 2: Signal detectors (TDD)

**Files:**
- Create: `src/lib/server/portfolio-signals.ts`
- Test: `src/lib/server/portfolio-signals.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/portfolio-signals.test.ts
import { describe, it, expect } from "vitest";
import { detectSignals, type SignalInput } from "./portfolio-signals";
import type { DCAPlan } from "@/lib/dca";
import type { PnLData, SBTCData } from "@/lib/stacks";

function plan(over: Partial<DCAPlan>): DCAPlan {
  return {
    id: 1, owner: "SP", token: "tok", amt: 1_000_000, ivl: 4550, leb: 0,
    bal: 10_000_000, tsd: 0, tss: 0, active: true, cat: 0, ...over,
  };
}
const empty: SignalInput = { dcaPlans: null, pnl: null, sbtcData: null, fearGreed: null };

describe("detectSignals", () => {
  it("returns [] when everything is absent", () => {
    expect(detectSignals(empty)).toEqual([]);
  });

  it("flags dca-runway-low when ≤3 swaps remain, with day math", () => {
    // bal/amt = 3 swaps; ivl 4550 → days = 3*4550/9360 ≈ 1.5
    const s = detectSignals({ ...empty, dcaPlans: [plan({ id: 7, amt: 1_000_000, bal: 3_000_000, ivl: 4550 })] });
    const sig = s.find((x) => x.kind === "dca-runway-low");
    expect(sig).toBeTruthy();
    expect(sig!.facts.planId).toBe(7);
    expect(sig!.facts.swapsLeft).toBe(3);
    expect(sig!.facts.daysLeft).toBeCloseTo(1.5, 1);
    expect(sig!.severity).toBe("medium");
  });

  it("runway with ≤1 swap is high severity", () => {
    const s = detectSignals({ ...empty, dcaPlans: [plan({ amt: 1_000_000, bal: 1_500_000 })] });
    expect(s.find((x) => x.kind === "dca-runway-low")!.severity).toBe("high");
  });

  it("flags dca-balance-empty (high) when bal < amt, not runway", () => {
    const s = detectSignals({ ...empty, dcaPlans: [plan({ id: 3, amt: 2_000_000, bal: 500_000 })] });
    expect(s.some((x) => x.kind === "dca-runway-low")).toBe(false);
    const sig = s.find((x) => x.kind === "dca-balance-empty");
    expect(sig!.severity).toBe("high");
    expect(sig!.facts.planId).toBe(3);
  });

  it("ignores inactive plans", () => {
    const s = detectSignals({ ...empty, dcaPlans: [plan({ active: false, bal: 0 })] });
    expect(s).toEqual([]);
  });

  it("flags dca-dip-buy only when F&G ≤25 AND an active plan exists", () => {
    const base = { ...empty, dcaPlans: [plan({ bal: 10_000_000 })] };
    expect(detectSignals({ ...base, fearGreed: { value: 20, classification: "Extreme Fear" } })
      .some((x) => x.kind === "dca-dip-buy")).toBe(true);
    expect(detectSignals({ ...base, fearGreed: { value: 60, classification: "Greed" } })
      .some((x) => x.kind === "dca-dip-buy")).toBe(false);
    expect(detectSignals({ ...empty, fearGreed: { value: 10, classification: "Extreme Fear" } })
      .some((x) => x.kind === "dca-dip-buy")).toBe(false);
  });

  it("flags pnl-gain / pnl-loss with thresholds and severity", () => {
    const pnl = (pct: number): PnLData => ({
      entries: [{ contractId: "c", symbol: "ALEX", name: "Alex", currentBalance: 1, currentPrice: 1,
        currentValue: 100, avgCostBasis: 1, totalCost: 80, unrealizedPnL: 25, unrealizedPct: pct,
        realizedPnL: 0 }],
      totalUnrealized: 25, totalRealized: 0, totalPnL: 25,
    });
    expect(detectSignals({ ...empty, pnl: pnl(25) }).find((x) => x.kind === "pnl-gain")!.severity).toBe("low");
    expect(detectSignals({ ...empty, pnl: pnl(60) }).find((x) => x.kind === "pnl-gain")!.severity).toBe("medium");
    expect(detectSignals({ ...empty, pnl: pnl(-25) }).find((x) => x.kind === "pnl-loss")!.severity).toBe("medium");
    expect(detectSignals({ ...empty, pnl: pnl(-50) }).find((x) => x.kind === "pnl-loss")!.severity).toBe("high");
    expect(detectSignals({ ...empty, pnl: pnl(5) })).toEqual([]);
  });

  it("ignores dust holdings (currentValue < 1) for PnL", () => {
    const pnl: PnLData = {
      entries: [{ contractId: "c", symbol: "DUST", name: "Dust", currentBalance: 1, currentPrice: 0,
        currentValue: 0.2, avgCostBasis: 1, totalCost: 1, unrealizedPnL: -1, unrealizedPct: -90, realizedPnL: 0 }],
      totalUnrealized: -1, totalRealized: 0, totalPnL: -1,
    };
    expect(detectSignals({ ...empty, pnl })).toEqual([]);
  });

  it("flags sbtc-depeg only when holding sBTC and not pegged", () => {
    const sbtc = (status: SBTCData["peg"]["status"], balance: number): SBTCData => ({
      balance, valueUsd: balance, bridgeHistory: [],
      peg: { btcPrice: 100000, sbtcPrice: 95000, deviation: -5, status },
    });
    expect(detectSignals({ ...empty, sbtcData: sbtc("depegged", 1000) }).find((x) => x.kind === "sbtc-depeg")!.severity).toBe("high");
    expect(detectSignals({ ...empty, sbtcData: sbtc("slight", 1000) }).find((x) => x.kind === "sbtc-depeg")!.severity).toBe("low");
    expect(detectSignals({ ...empty, sbtcData: sbtc("pegged", 1000) }).some((x) => x.kind === "sbtc-depeg")).toBe(false);
    expect(detectSignals({ ...empty, sbtcData: sbtc("depegged", 0) }).some((x) => x.kind === "sbtc-depeg")).toBe(false);
  });

  it("sorts by severity and caps at 6 signals", () => {
    const plans = Array.from({ length: 10 }, (_, i) => plan({ id: i, amt: 1_000_000, bal: 100_000 })); // all balance-empty (high)
    const out = detectSignals({ ...empty, dcaPlans: plans });
    expect(out.length).toBe(6);
    expect(out.every((x) => x.severity === "high")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/portfolio-signals.test.ts`
Expected: FAIL — cannot find module `./portfolio-signals`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/server/portfolio-signals.ts
// Pure deterministic detectors: portfolio + market facts → structured signals
// with REAL numbers. The LLM phrasing layer only references these numbers; it
// never computes them, so a hallucinating model can't misstate balances/PnL.
import type { DCAPlan } from "@/lib/dca";
import type { PnLData, SBTCData } from "@/lib/stacks";

export interface FearGreedLite {
  value: number;
  classification: string;
}

export type SignalKind =
  | "dca-runway-low"
  | "dca-balance-empty"
  | "dca-dip-buy"
  | "pnl-gain"
  | "pnl-loss"
  | "sbtc-depeg";

export interface PortfolioSignal {
  kind: SignalKind;
  severity: "high" | "medium" | "low";
  facts: Record<string, string | number>;
}

export interface SignalInput {
  dcaPlans: DCAPlan[] | null;
  pnl: PnLData | null;
  sbtcData: SBTCData | null;
  fearGreed: FearGreedLite | null;
}

// Nakamoto Stacks produces ~6.5 blocks/min (see INTERVALS in src/lib/dca.ts).
const BLOCKS_PER_DAY = 6.5 * 60 * 24; // 9360
const MAX_SIGNALS = 6;
const DUST_USD = 1;
const SEVERITY_ORDER: Record<PortfolioSignal["severity"], number> = { high: 0, medium: 1, low: 2 };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function detectSignals(input: SignalInput): PortfolioSignal[] {
  const signals: PortfolioSignal[] = [];
  const activePlans = (input.dcaPlans ?? []).filter((p) => p.active);

  // DCA runway / balance-empty (mutually exclusive per plan)
  for (const p of activePlans) {
    if (p.amt <= 0) continue;
    const swapsLeft = Math.floor(p.bal / p.amt);
    if (swapsLeft < 1) {
      signals.push({
        kind: "dca-balance-empty",
        severity: "high",
        facts: { planId: p.id, balance: p.bal, amtPerSwap: p.amt },
      });
    } else if (swapsLeft <= 3) {
      signals.push({
        kind: "dca-runway-low",
        severity: swapsLeft <= 1 ? "high" : "medium",
        facts: { planId: p.id, swapsLeft, daysLeft: round1((swapsLeft * p.ivl) / BLOCKS_PER_DAY) },
      });
    }
  }

  // Dip-buy: market in fear AND user is actively accumulating
  if (input.fearGreed && input.fearGreed.value <= 25 && activePlans.length > 0) {
    signals.push({
      kind: "dca-dip-buy",
      severity: "low",
      facts: {
        fearGreedValue: input.fearGreed.value,
        classification: input.fearGreed.classification,
        planCount: activePlans.length,
      },
    });
  }

  // PnL milestones
  for (const e of input.pnl?.entries ?? []) {
    if (e.currentValue < DUST_USD) continue;
    if (e.unrealizedPct >= 20) {
      signals.push({
        kind: "pnl-gain",
        severity: e.unrealizedPct >= 50 ? "medium" : "low",
        facts: {
          symbol: e.symbol,
          unrealizedPct: round1(e.unrealizedPct),
          unrealizedPnL: Math.round(e.unrealizedPnL),
          currentValue: Math.round(e.currentValue),
        },
      });
    } else if (e.unrealizedPct <= -20) {
      signals.push({
        kind: "pnl-loss",
        severity: e.unrealizedPct <= -40 ? "high" : "medium",
        facts: {
          symbol: e.symbol,
          unrealizedPct: round1(e.unrealizedPct),
          unrealizedPnL: Math.round(e.unrealizedPnL),
        },
      });
    }
  }

  // sBTC depeg (only relevant if the user holds sBTC)
  const peg = input.sbtcData?.peg;
  if (input.sbtcData && input.sbtcData.balance > 0 && peg && peg.status !== "pegged") {
    signals.push({
      kind: "sbtc-depeg",
      severity: peg.status === "depegged" ? "high" : "low",
      facts: {
        deviationPct: round1(peg.deviation),
        pegPrice: Math.round(peg.sbtcPrice),
        balance: input.sbtcData.balance,
      },
    });
  }

  return signals
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, MAX_SIGNALS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/portfolio-signals.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/portfolio-signals.ts src/lib/server/portfolio-signals.test.ts
git commit -m "feat(ai): deterministic portfolio signal detectors"
```

---

## Task 3: Personal-alerts zod schema (TDD)

**Files:**
- Create: `src/lib/server/personal-alerts-schema.ts`
- Test: `src/lib/server/personal-alerts-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/personal-alerts-schema.test.ts
import { describe, it, expect } from "vitest";
import { parsePersonalAlerts } from "./personal-alerts-schema";

const valid = {
  alerts: [
    { title: "DCA low", description: "Plan 3 has ~2 days left.", type: "warning", priority: "high" },
    { title: "Up 30%", description: "ALEX is up.", type: "opportunity", priority: "low" },
  ],
};

describe("parsePersonalAlerts", () => {
  it("accepts a valid object", () => {
    expect(parsePersonalAlerts(valid).alerts).toHaveLength(2);
  });

  it("drops alerts with an invalid enum instead of failing the parse", () => {
    const out = parsePersonalAlerts({
      alerts: [
        { title: "ok", description: "d", type: "warning", priority: "high" },
        { title: "bad", description: "d", type: "explosive", priority: "high" },
      ],
    });
    expect(out.alerts).toHaveLength(1);
    expect(out.alerts[0].title).toBe("ok");
  });

  it("defaults alerts to [] when absent", () => {
    expect(parsePersonalAlerts({}).alerts).toEqual([]);
  });

  it("throws when alerts is not an array-like value", () => {
    expect(() => parsePersonalAlerts({ alerts: "nope" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/personal-alerts-schema.test.ts`
Expected: FAIL — cannot find module `./personal-alerts-schema`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/server/personal-alerts-schema.ts
// Validates the LLM's personalized-alert JSON. Mirrors ai-insights-schema.ts:
// json_object guarantees valid JSON, not the right shape. Lenient on per-alert
// noise (drops elements with a bad enum), strict on the container.
import { z } from "zod";
import type { PersonalAlert } from "@/lib/ai-portfolio";

const lenientArray = <T extends z.ZodTypeAny>(item: T) =>
  z.array(z.unknown()).transform((arr) =>
    arr.flatMap((el) => {
      const r = item.safeParse(el);
      return r.success ? [r.data as z.infer<T>] : [];
    })
  );

const alertSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(["opportunity", "warning", "info"]),
  priority: z.enum(["high", "medium", "low"]),
});

const schema = z.object({
  alerts: lenientArray(alertSchema).default([]),
});

export function parsePersonalAlerts(raw: unknown): { alerts: PersonalAlert[] } {
  return schema.parse(raw);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/personal-alerts-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/personal-alerts-schema.ts src/lib/server/personal-alerts-schema.test.ts
git commit -m "feat(ai): zod schema for personalized alerts"
```

---

## Task 4: Template fallback (TDD)

**Files:**
- Create: `src/lib/server/personal-alerts.ts`
- Test: `src/lib/server/personal-alerts.test.ts`

This task adds only `templateAlerts()`. The Groq wiring (`generatePersonalAlerts`) is added in Task 5.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/personal-alerts.test.ts
import { describe, it, expect } from "vitest";
import { templateAlerts } from "./personal-alerts";
import type { PortfolioSignal } from "./portfolio-signals";

describe("templateAlerts", () => {
  it("returns [] for no signals", () => {
    expect(templateAlerts([])).toEqual([]);
  });

  it("maps each kind to the right type/priority and references its numbers", () => {
    const signals: PortfolioSignal[] = [
      { kind: "dca-runway-low", severity: "medium", facts: { planId: 3, swapsLeft: 2, daysLeft: 1.5 } },
      { kind: "dca-balance-empty", severity: "high", facts: { planId: 4, balance: 500000, amtPerSwap: 1000000 } },
      { kind: "dca-dip-buy", severity: "low", facts: { fearGreedValue: 18, classification: "Extreme Fear", planCount: 2 } },
      { kind: "pnl-gain", severity: "low", facts: { symbol: "ALEX", unrealizedPct: 32, unrealizedPnL: 40, currentValue: 160 } },
      { kind: "pnl-loss", severity: "high", facts: { symbol: "WELSH", unrealizedPct: -45, unrealizedPnL: -90 } },
      { kind: "sbtc-depeg", severity: "high", facts: { deviationPct: -6, pegPrice: 94000, balance: 1000 } },
    ];
    const out = templateAlerts(signals);
    expect(out).toHaveLength(6);

    const runway = out[0];
    expect(runway.type).toBe("warning");
    expect(runway.priority).toBe("medium");
    expect(runway.title).toContain("3");        // planId
    expect(runway.description).toContain("1.5"); // daysLeft

    expect(out[2].type).toBe("opportunity");     // dip-buy
    expect(out[3].type).toBe("opportunity");     // pnl-gain
    expect(out[3].description).toContain("ALEX");
    expect(out[4].type).toBe("warning");         // pnl-loss
    expect(out[5].type).toBe("warning");         // depeg
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/personal-alerts.test.ts`
Expected: FAIL — cannot find module `./personal-alerts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/server/personal-alerts.ts
// Turns deterministic signals into client-facing alerts. templateAlerts() is
// the deterministic fallback (and the source of truth for type/priority
// mapping); generatePersonalAlerts() (Task 5) asks Groq to phrase them and
// falls back here on any failure.
import type { PersonalAlert } from "@/lib/ai-portfolio";
import type { PortfolioSignal, SignalKind } from "./portfolio-signals";

const TYPE_BY_KIND: Record<SignalKind, PersonalAlert["type"]> = {
  "dca-runway-low": "warning",
  "dca-balance-empty": "warning",
  "dca-dip-buy": "opportunity",
  "pnl-gain": "opportunity",
  "pnl-loss": "warning",
  "sbtc-depeg": "warning",
};

function template(sig: PortfolioSignal): PersonalAlert {
  const f = sig.facts;
  const type = TYPE_BY_KIND[sig.kind];
  const priority = sig.severity;
  switch (sig.kind) {
    case "dca-runway-low":
      return { type, priority, title: `DCA plan #${f.planId} running low`,
        description: `About ${f.daysLeft} days (${f.swapsLeft} swaps) of balance left. Top it up to keep the schedule going.` };
    case "dca-balance-empty":
      return { type, priority, title: `DCA plan #${f.planId} can't fund next swap`,
        description: `Balance ${f.balance} is below the ${f.amtPerSwap} per-swap amount. Add funds to resume.` };
    case "dca-dip-buy":
      return { type, priority, title: `Buying the dip`,
        description: `Fear & Greed is ${f.fearGreedValue} (${f.classification}) and your ${f.planCount} active DCA plan(s) are accumulating into weakness.` };
    case "pnl-gain":
      return { type, priority, title: `${f.symbol} up ${f.unrealizedPct}%`,
        description: `Unrealized +$${f.unrealizedPnL} on a $${f.currentValue} position. Consider whether to take some profit.` };
    case "pnl-loss":
      return { type, priority, title: `${f.symbol} down ${f.unrealizedPct}%`,
        description: `Unrealized $${f.unrealizedPnL}. Review your thesis or DCA level.` };
    case "sbtc-depeg":
      return { type, priority, title: `sBTC off peg`,
        description: `sBTC is ${f.deviationPct}% from BTC (≈$${f.pegPrice}). Be cautious with sBTC swaps right now.` };
  }
}

export function templateAlerts(signals: PortfolioSignal[]): PersonalAlert[] {
  return signals.map(template);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/personal-alerts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/personal-alerts.ts src/lib/server/personal-alerts.test.ts
git commit -m "feat(ai): deterministic template fallback for personalized alerts"
```

---

## Task 5: Groq phrasing layer

**Files:**
- Modify: `src/lib/server/personal-alerts.ts`

`generatePersonalAlerts()` calls Groq to phrase/prioritize the signals, validates with the schema, and falls back to `templateAlerts()` on any failure (including a missing API key). The live Groq path is not unit-tested (network); its no-key fallback is exercised in Step 3.

- [ ] **Step 1: Add the implementation**

First add three imports to the **top import block** of `src/lib/server/personal-alerts.ts` (the existing imports of `PersonalAlert` and `PortfolioSignal/SignalKind` stay as they are):

```ts
import Groq from "groq-sdk";
import { parsePersonalAlerts } from "./personal-alerts-schema";
import type { FearGreedLite } from "./portfolio-signals";
```

Then append the rest to the bottom of the file:

```ts
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "llama-3.1-8b-instant";
const GROQ_TIMEOUT_MS = 20_000;

export interface MarketContext {
  fearGreed: FearGreedLite | null;
  stxChange24h: number | null;
}

function buildPrompt(signals: PortfolioSignal[], market: MarketContext): string {
  return `You are a crypto portfolio analyst for a Stacks (STX) DCA app. Below are
factual signals detected from the user's own wallet, each with real numbers.

## Signals
${JSON.stringify(signals, null, 2)}

## Market context
- Fear & Greed: ${market.fearGreed ? `${market.fearGreed.value} (${market.fearGreed.classification})` : "N/A"}
- STX 24h change: ${market.stxChange24h != null ? `${market.stxChange24h.toFixed(2)}%` : "N/A"}

Select the 2-4 most important signals and write user-facing alerts. Respond with a
JSON object (no markdown fences):
{
  "alerts": [
    {"title": "short title", "description": "1-2 sentences", "type": "opportunity|warning|info", "priority": "high|medium|low"}
  ]
}

Rules:
- Use ONLY numbers that appear in the signal facts. Never compute or invent figures.
- Keep priority consistent with each signal's severity.
- Be concise and actionable. Return ONLY valid JSON.`;
}

export async function generatePersonalAlerts(
  signals: PortfolioSignal[],
  market: MarketContext
): Promise<PersonalAlert[]> {
  if (signals.length === 0) return [];
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return templateAlerts(signals);

  const groq = new Groq({ apiKey });
  const prompt = buildPrompt(signals, market);
  const callModel = (model: string) =>
    groq.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: "You are a crypto portfolio analyst. Respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      },
      { timeout: GROQ_TIMEOUT_MS, maxRetries: 1 }
    );

  try {
    let completion;
    try {
      completion = await callModel(GROQ_MODEL);
    } catch (err) {
      console.warn(`[Portfolio Alerts] primary ${GROQ_MODEL} failed, falling back to ${GROQ_FALLBACK_MODEL}:`, err);
      completion = await callModel(GROQ_FALLBACK_MODEL);
    }
    const text = completion.choices[0]?.message?.content ?? "{}";
    const { alerts } = parsePersonalAlerts(JSON.parse(text));
    // If the model returned nothing usable, fall back rather than show an empty section.
    return alerts.length > 0 ? alerts : templateAlerts(signals);
  } catch (err) {
    console.warn("[Portfolio Alerts] generation failed, using template fallback:", err);
    return templateAlerts(signals);
  }
}
```

(`PortfolioSignal` and `PersonalAlert` are already imported from Task 4; only the three imports above are new.)

- [ ] **Step 2: Add a fallback test**

Append to `src/lib/server/personal-alerts.test.ts`:

```ts
import { generatePersonalAlerts } from "./personal-alerts";

describe("generatePersonalAlerts (no API key)", () => {
  const prev = process.env.GROQ_API_KEY;
  beforeEach(() => { delete process.env.GROQ_API_KEY; });
  afterEach(() => { if (prev) process.env.GROQ_API_KEY = prev; });

  it("returns [] for no signals without calling Groq", async () => {
    expect(await generatePersonalAlerts([], { fearGreed: null, stxChange24h: null })).toEqual([]);
  });

  it("falls back to templated alerts when no API key is set", async () => {
    const out = await generatePersonalAlerts(
      [{ kind: "dca-balance-empty", severity: "high", facts: { planId: 4, balance: 1, amtPerSwap: 2 } }],
      { fearGreed: null, stxChange24h: null }
    );
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("warning");
  });
});
```

Update the import line at the top of the test file to include `beforeEach, afterEach`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/lib/server/personal-alerts.test.ts`
Expected: PASS (template + no-key fallback cases green).

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/personal-alerts.ts src/lib/server/personal-alerts.test.ts
git commit -m "feat(ai): Groq phrasing for personalized alerts with template fallback"
```

---

## Task 6: Per-address cache + rate-limit helpers

**Files:**
- Modify: `src/lib/server/ai-insights-cache.ts`

- [ ] **Step 1: Add the helpers**

Append to `src/lib/server/ai-insights-cache.ts`:

```ts
import type { PortfolioInsightsResponse } from "@/lib/ai-portfolio";

const PORTFOLIO_CACHE_PREFIX = "ai-portfolio:v1:";
const PORTFOLIO_CACHE_TTL_SECONDS = 12 * 60; // 12 minutes

export async function getCachedPortfolioInsights(
  address: string
): Promise<PortfolioInsightsResponse | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    return (await r.get<PortfolioInsightsResponse>(PORTFOLIO_CACHE_PREFIX + address)) ?? null;
  } catch {
    return null;
  }
}

export async function setCachedPortfolioInsights(
  address: string,
  data: PortfolioInsightsResponse
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(PORTFOLIO_CACHE_PREFIX + address, data, { ex: PORTFOLIO_CACHE_TTL_SECONDS });
  } catch {
    // best-effort
  }
}

/** Bust a wallet's cached alerts (called after a tx confirms). */
export async function deleteCachedPortfolioInsights(address: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(PORTFOLIO_CACHE_PREFIX + address);
  } catch {
    // best-effort
  }
}

/** Fixed-window rate limit keyed by wallet address. Fails open without Redis. */
export async function isPortfolioRateLimited(address: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const key = `ai-portfolio:rl:${address}`;
  try {
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    return count > RATE_LIMIT_MAX;
  } catch {
    return false;
  }
}
```

Note: `getRedis`, `RATE_LIMIT_WINDOW_SECONDS`, and `RATE_LIMIT_MAX` already exist in this file (from the earlier Redis-cache work) and are reused.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next" | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/ai-insights-cache.ts
git commit -m "feat(ai): per-address Redis cache + rate-limit for portfolio insights"
```

---

## Task 7: The endpoint

**Files:**
- Create: `src/app/api/ai/portfolio-insights/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/ai/portfolio-insights/route.ts
import { NextResponse } from "next/server";
import { getPortfolioSnapshot, isValidStacksAddress } from "@/lib/server/portfolio-snapshot";
import { getMarketSnapshot } from "@/lib/server/market-snapshot";
import { detectSignals } from "@/lib/server/portfolio-signals";
import { generatePersonalAlerts } from "@/lib/server/personal-alerts";
import {
  getCachedPortfolioInsights,
  setCachedPortfolioInsights,
  isPortfolioRateLimited,
} from "@/lib/server/ai-insights-cache";
import type { PortfolioInsightsResponse } from "@/lib/ai-portfolio";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim() ?? "";
  if (!isValidStacksAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  if (await isPortfolioRateLimited(address)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const cached = await getCachedPortfolioInsights(address);
  if (cached) return NextResponse.json(cached);

  try {
    const [portfolio, market] = await Promise.all([
      getPortfolioSnapshot(address),
      getMarketSnapshot(),
    ]);

    const signals = detectSignals({
      dcaPlans: portfolio.dcaPlans,
      pnl: portfolio.pnl,
      sbtcData: portfolio.sbtcData,
      fearGreed: market.fearGreed,
    });

    const alerts = await generatePersonalAlerts(signals, {
      fearGreed: market.fearGreed,
      stxChange24h: market.stxStats?.change24h ?? null,
    });

    const response: PortfolioInsightsResponse = {
      generatedAt: new Date().toISOString(),
      alerts,
    };
    await setCachedPortfolioInsights(address, response);
    return NextResponse.json(response);
  } catch (err) {
    console.error("[Portfolio Insights] Error:", err);
    return NextResponse.json({ error: "Failed to generate portfolio insights" }, { status: 500 });
  }
}
```

Note: confirm `isValidStacksAddress` is exported from `src/lib/server/portfolio-snapshot.ts` (it is — the invalidate route imports it). Confirm `getPortfolioSnapshot` is exported there too.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next" | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/portfolio-insights/route.ts
git commit -m "feat(ai): /api/ai/portfolio-insights endpoint"
```

---

## Task 8: Bust AI cache on portfolio invalidate

**Files:**
- Modify: `src/app/api/portfolio/invalidate/route.ts`

- [ ] **Step 1: Add the Redis bust alongside the existing tag expiry**

In `src/app/api/portfolio/invalidate/route.ts`, add the import near the top:

```ts
import { deleteCachedPortfolioInsights } from "@/lib/server/ai-insights-cache";
```

Then, immediately after the existing `await cache.expireTag(\`portfolio:${address}\`);` line, add:

```ts
  // Personalized AI alerts are derived from the snapshot, so bust them too —
  // otherwise they'd stay stale for up to the 12-min TTL after a plan changes.
  await deleteCachedPortfolioInsights(address);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next" | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/portfolio/invalidate/route.ts
git commit -m "feat(ai): bust personalized alert cache on portfolio invalidate"
```

---

## Task 9: Client hook

**Files:**
- Create: `src/hooks/usePortfolioInsights.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/usePortfolioInsights.ts
"use client";

import useSWR from "swr";
import { fetchPortfolioInsights, type PortfolioInsightsResponse } from "@/lib/ai-portfolio";

const REFRESH_MS = 12 * 60_000; // matches the 12-min server cache TTL
const DEDUP_MS = 60_000;

export function usePortfolioInsights(address: string | undefined) {
  return useSWR<PortfolioInsightsResponse>(
    address ? ["portfolio-insights", address] : null,
    () => fetchPortfolioInsights(address!),
    { refreshInterval: REFRESH_MS, dedupingInterval: DEDUP_MS, revalidateOnFocus: false }
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next" | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePortfolioInsights.ts
git commit -m "feat(ai): usePortfolioInsights SWR hook"
```

---

## Task 10: "Your Position" card

**Files:**
- Create: `src/components/ai/YourPositionCard.tsx`

Reuses the same alert visual language as `SmartAlertsCard` (theme-agnostic colors). Handles loading, has-alerts, all-clear, and error states.

- [ ] **Step 1: Write the component**

```tsx
// src/components/ai/YourPositionCard.tsx
"use client";

import type { CSSProperties } from "react";
import { Sparkles, Zap, AlertTriangle, Info, CheckCircle2, RefreshCw } from "lucide-react";
import { usePortfolioInsights } from "@/hooks/usePortfolioInsights";
import type { PersonalAlert } from "@/lib/ai-portfolio";

const AMBER = "#F59E0B";
const BLUE = "#3B82F6";

const typeConfig: Record<PersonalAlert["type"], { icon: typeof Zap; rowStyle: CSSProperties; iconStyle: CSSProperties }> = {
  opportunity: { icon: Zap, rowStyle: { borderLeftColor: "var(--accent)", backgroundColor: "var(--accent-dim)" }, iconStyle: { color: "var(--accent)" } },
  warning: { icon: AlertTriangle, rowStyle: { borderLeftColor: AMBER, backgroundColor: "rgba(245,158,11,0.10)" }, iconStyle: { color: AMBER } },
  info: { icon: Info, rowStyle: { borderLeftColor: BLUE, backgroundColor: "rgba(59,130,246,0.10)" }, iconStyle: { color: BLUE } },
};

const priorityBadge: Record<PersonalAlert["priority"], CSSProperties> = {
  high: { backgroundColor: "rgba(248,113,113,0.15)", color: "#F87171" },
  medium: { backgroundColor: "rgba(251,191,36,0.15)", color: "#FBBF24" },
  low: { backgroundColor: "var(--bg-elevated)", color: "var(--text-muted)" },
};

export default function YourPositionCard({ address }: { address: string }) {
  const { data, error, isLoading, isValidating, mutate } = usePortfolioInsights(address);

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--accent)" }} />
          <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Your Position</h3>
          <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}>Personalized</span>
        </div>
        <button onClick={() => mutate()} disabled={isValidating}
          className="flex items-center gap-1.5 text-xs disabled:opacity-50" style={{ color: "var(--text-muted)" }}>
          <RefreshCw size={12} className={isValidating ? "animate-spin" : ""} />
        </button>
      </div>

      {isLoading && !data && (
        <div className="space-y-2 animate-pulse">
          {[0, 1].map((i) => <div key={i} className="h-14 rounded-xl" style={{ backgroundColor: "var(--bg-elevated)" }} />)}
        </div>
      )}

      {error && !data && (
        <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
          Couldn&apos;t load your alerts. Try refreshing in a moment.
        </p>
      )}

      {data && data.alerts.length === 0 && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <CheckCircle2 size={16} style={{ color: "var(--accent)" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Your portfolio looks healthy — no alerts right now.
          </span>
        </div>
      )}

      {data && data.alerts.length > 0 && (
        <div className="space-y-3">
          {data.alerts.map((alert, i) => {
            const config = typeConfig[alert.type];
            const Icon = config.icon;
            return (
              <div key={i} className="flex gap-3 p-3 rounded-xl border-l-4" style={config.rowStyle}>
                <Icon size={18} className="shrink-0 mt-0.5" style={config.iconStyle} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{alert.title}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={priorityBadge[alert.priority]}>{alert.priority}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next" | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/YourPositionCard.tsx
git commit -m "feat(ai): YourPositionCard for personalized alerts"
```

---

## Task 11: Wire into the AI page

**Files:**
- Modify: `src/components/ai/AIPageContent.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/ai/AIPageContent.tsx`, add:

```ts
import { useWalletStore } from "@/store/walletStore";
import YourPositionCard from "./YourPositionCard";
```

- [ ] **Step 2: Read wallet state in the component**

Immediately after the existing `const { data, error, isLoading, isValidating, mutate } = useAIInsights();` line inside `AIPageContent`, add:

```ts
  const { isConnected, stxAddress } = useWalletStore();
```

- [ ] **Step 3: Render the section above the grid**

In the `{data && (...)}` data block, insert the "Your Position" card as the first child of the grid (before the `NewsDigestCard` wrapper). Change:

```tsx
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="lg:col-span-2">
              <NewsDigestCard summary={data.newsDigest.summary} items={data.newsDigest.items} />
            </div>
```

to:

```tsx
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {isConnected && stxAddress && (
              <div className="lg:col-span-2">
                <YourPositionCard address={stxAddress} />
              </div>
            )}
            <div className="lg:col-span-2">
              <NewsDigestCard summary={data.newsDigest.summary} items={data.newsDigest.items} />
            </div>
```

Note: confirm `useWalletStore` exposes `isConnected` and `stxAddress` (it does — see `src/store/walletStore.ts`).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next" | head`
Run: `npx eslint src/components/ai/AIPageContent.tsx src/components/ai/YourPositionCard.tsx`
Expected: no output from either.

- [ ] **Step 5: Commit**

```bash
git add src/components/ai/AIPageContent.tsx
git commit -m "feat(ai): show Your Position section on /ai when wallet connected"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run the full unit suite**

Run: `npm test`
Expected: all tests pass, including the new `portfolio-signals`, `personal-alerts-schema`, and `personal-alerts` suites.

- [ ] **Step 2: Production build**

Run: `find .next -name "* 2.*" -delete 2>/dev/null; npm run build`
Expected: build succeeds; `/api/ai/portfolio-insights` appears in the route list.

- [ ] **Step 3: Commit any incidental fixes** (only if needed)

```bash
git add -A && git commit -m "chore(ai): fixes from final verification"
```

---

## Self-Review Notes

- **Spec coverage:** Surface (Task 11), content=actionable alerts (Tasks 2/4/10), auto + per-address cache (Tasks 6/9), hybrid detectors+LLM+fallback (Tasks 2/4/5), per-address rate-limit (Task 6), invalidate bust (Task 8), all 6 detectors incl. sbtc-depeg (Task 2), zero-signal skip-Groq (Task 5/7), UI states incl. all-clear (Task 10). All covered.
- **Number safety:** numbers originate only in `detectSignals` (Task 2); the LLM prompt forbids invented figures and the schema/fallback never fabricate numbers.
- **Type consistency:** `PersonalAlert` / `PortfolioInsightsResponse` (Task 1) are reused verbatim by schema (3), template/Groq (4/5), cache (6), route (7), hook (9), UI (10). `PortfolioSignal` / `SignalInput` / `FearGreedLite` (Task 2) reused by template (4), Groq (5), route (7).
```
