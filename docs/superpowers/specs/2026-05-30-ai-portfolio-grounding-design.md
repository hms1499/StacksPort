# AI Portfolio Grounding — Design

**Date:** 2026-05-30
**Status:** Approved (pending spec review)
**Feature area:** AI tab (`/ai`)

## Goal

Turn the AI tab from generic, globally-shared market intelligence into something
personal: a "Your Position" section that surfaces **actionable alerts grounded in
the connected wallet's real holdings, DCA plans, and PnL**. This is feature #1 of
three (the others — Smart DCA tie-in, chat assistant — build on the grounding
foundation laid here).

## Decisions (locked during brainstorming)

- **Surface:** a new, separate "Your Position" section at the top of `/ai`. The
  four existing global market cards (Sentiment, Social Signals, Smart Alerts,
  News Digest) stay exactly as-is and keep their shared global cache.
- **Content:** personalized **actionable alerts** (reusing the SmartAlertsCard
  visual style), not a narrative summary.
- **Trigger:** auto-generate when a connected wallet opens the tab; cache
  per-address in Redis (TTL 12 min).
- **Generation strategy:** **hybrid** — deterministic detectors compute the
  factual signals (with real numbers); the LLM only selects, prioritizes, and
  phrases them. Numbers never come from the LLM. Degrades to deterministic
  templated alerts when Groq is unavailable.

## Non-goals (YAGNI)

- No changes to the existing global `/api/ai/insights` route or its cards.
- No chat / multi-turn / tool calling (that is feature #3/#2, later).
- No Vercel AI SDK migration — stay on `groq-sdk` + zod (consistent with the
  hardening work just shipped).
- v1 detector set is fixed (6 detectors below). Stacking rewards, advanced
  cost-basis, multi-hop analysis are deferred.

## Architecture

New units, each with a single responsibility and independently testable:

| Unit | File | Responsibility | Depends on |
|---|---|---|---|
| Signal detectors | `src/lib/server/portfolio-signals.ts` | Pure: portfolio + market → `PortfolioSignal[]` (facts + real numbers) | types only, no I/O |
| LLM phrasing + fallback | `src/lib/server/personal-alerts.ts` | `PortfolioSignal[]` → `PersonalAlert[]` (Groq selects/prioritizes/phrases; deterministic template fallback) | groq-sdk, schema |
| Alert zod schema | `src/lib/server/personal-alerts-schema.ts` | Validate LLM output (mirrors `ai-insights-schema.ts`) | zod |
| Per-address cache | extend `src/lib/server/ai-insights-cache.ts` | cache + rate-limit keyed by address | Redis |
| Endpoint | `src/app/api/ai/portfolio-insights/route.ts` | Orchestrate snapshot → detect → phrase → cache | the above |
| Client hook | `src/hooks/usePortfolioInsights.ts` | SWR, only fetch when address present | useSWR |
| UI | `src/components/ai/YourPositionCard.tsx` | Render alerts (SmartAlerts style) | — |

**Boundary rule:** all numbers (runway days, PnL %, balances) are produced only by
the deterministic detectors. The LLM receives them as facts and only writes copy
and assigns priority. The new endpoint is fully separate from the global
`/api/ai/insights` and does not touch its cache.

## Data Flow

```
AIPageContent
  └─ stxAddress (walletStore) ─ if connected ─> usePortfolioInsights(address)
       └─> GET /api/ai/portfolio-insights?address=
              ├─ rateLimit(address) ──> 429 if exceeded
              ├─ cache hit (Redis, per-address, TTL 720s) ──> return
              └─ miss:
                   ├─ Promise.all[ getPortfolioSnapshot(address), getMarketSnapshot() ]
                   ├─ detectSignals(portfolio, market)   ← FACTS (real numbers, deterministic)
                   ├─ if 0 signals ──> return { alerts: [] }  (skip Groq, save cost)
                   ├─ generatePersonalAlerts(signals)    ← Groq selects/phrases, numbers pass-through
                   │     └─ Groq error/absent/parse-fail ──> templateAlerts(signals)  (degrade)
                   └─ setCache(address) ──> return { generatedAt, alerts }
```

## Signal Detectors (v1)

Shared shape:

```ts
interface PortfolioSignal {
  kind: "dca-runway-low" | "dca-balance-empty" | "dca-dip-buy"
      | "pnl-gain" | "pnl-loss" | "sbtc-depeg";
  severity: "high" | "medium" | "low";
  facts: Record<string, string | number>; // real numbers, for LLM reference + template fallback
}
```

Block-time constant: Nakamoto Stacks ≈ 6.5 blocks/min → `BLOCKS_PER_DAY = 9360`
(matches the `INTERVALS` comments in `src/lib/dca.ts`).

| Kind | Condition (from available data) | facts | severity |
|---|---|---|---|
| `dca-runway-low` | plan `active` & `floor(bal/amt)` ≤ 3 swaps left | planId, swapsLeft, daysLeft = `swapsLeft × ivl / 9360` | ≤1 swap → high, else medium |
| `dca-balance-empty` | plan `active` but `bal < amt` (can't fund next swap) | planId, balance, amtPerSwap | high |
| `dca-dip-buy` | `fearGreed.value ≤ 25` **and** ≥1 active STX→sBTC DCA | fearGreedValue, classification, planCount | low (opportunity) |
| `pnl-gain` | a holding has `unrealizedPct ≥ +20` | symbol, unrealizedPct, unrealizedPnL, currentValue | ≥+50 → medium, else low |
| `pnl-loss` | a holding has `unrealizedPct ≤ −20` | symbol, unrealizedPct, unrealizedPnL | ≤−40 → high, else medium |
| `sbtc-depeg` | `sbtcData.peg` deviates beyond threshold & user holds sBTC | pegPrice, deviationPct, balance | by deviation |

Data shapes (verified): `DCAPlan` (`id, amt, ivl, bal, active`), `PnLEntry`
(`symbol, unrealizedPct, unrealizedPnL, currentValue`), `SBTCData`
(`balance, peg: SBTCPegStatus`), `FearGreed` (`value, classification`).

**Selection:** run all detectors → collect signals → sort by severity → cap at 6
before sending to the LLM (bounds prompt size + cost). Zero signals → return `[]`
without calling Groq.

**v1 caveat:** `sbtc-depeg` depends on the `SBTCPegStatus` shape; verify during
planning. If it diverges from the assumption, drop it from v1 (5 detectors still
deliver value).

## LLM Phrasing, Fallback, Schema

Client-facing output:

```ts
interface PersonalAlert {
  title: string;        // short, e.g. "DCA plan #3 running low"
  description: string;  // 1-2 sentences, references facts (no invented numbers)
  type: "opportunity" | "warning" | "info";
  priority: "high" | "medium" | "low";
}
interface PortfolioInsightsResponse {
  generatedAt: string;
  alerts: PersonalAlert[]; // [] when no signals
}
```

- **Prompt** receives the signal list (facts as JSON) + brief market context
  (F&G, STX 24h). Instruction: pick the 2-4 most important, assign type/priority,
  write title+description, **use only numbers present in facts — never compute or
  invent figures**.
- Reuses shipped infra: `GROQ_MODEL` + fallback model, 20s timeout,
  `response_format: json_object`.
- **Validation:** zod schema in `personal-alerts-schema.ts` using the same
  `lenientArray(alertSchema)` pattern as `ai-insights-schema.ts` (drops elements
  with a bad enum, rejects structurally broken output).
- **Deterministic fallback (`templateAlerts(signals)`):** on Groq error /
  missing `GROQ_API_KEY` / parse failure, build alerts from per-`kind` templates
  with a fixed `kind → {type, priority}` map. The "Your Position" section is
  never blank because the AI failed, and the numbers are always correct.

## Caching & Rate-limit (extend `ai-insights-cache.ts`)

- `getCachedPortfolioInsights(address)` / `setCachedPortfolioInsights(address, data)`
  — key `ai-portfolio:v1:<address>`, TTL **720s (12 min)**.
- Per-address rate-limit key `ai-portfolio:rl:<address>` (reuse the 10/60s window).
- Redis absent → degrade to null/no-op (same as existing helpers).
- **Invalidation:** the existing `/api/portfolio/invalidate` (called after a DCA
  tx confirms) additionally busts `ai-portfolio:v1:<address>` so alerts don't go
  stale after the user funds/edits a plan.

## UI / UX

- "Your Position" block at the **top** of `/ai` (above News Digest), full width,
  rendered only when `isConnected && stxAddress`.
- **Not connected:** block not rendered (global cards unchanged, no noisy CTA).
- **Loading:** existing Skeleton style.
- **Has alerts:** list in SmartAlertsCard style (theme-agnostic after E1) — icon
  by `type`, badge by `priority`. Header: `Sparkles` + "Your Position" +
  "Personalized" tag.
- **Zero alerts (all clear):** gentle state — "Your portfolio looks healthy — no
  alerts right now", check icon. No re-polling storm.
- **Error:** neutral message + retry (E2 pattern), does not cover the global cards.
- **Refresh:** reuse the page's existing header Refresh button (revalidates both
  global + personal); no separate button.

Hook `usePortfolioInsights`: SWR key `["portfolio-insights", address]`, fetch only
when address truthy; `refreshInterval` ≈ TTL (12 min), sensible `dedupingInterval`.

## Testing (TDD)

Focus on the deterministic layer where the LLM can't mask bugs:

1. **Detectors** (`portfolio-signals.test.ts`) — the bulk of the value: runway math
   (`9360`), PnL thresholds (±20/±40/±50), dip-buy requires both F&G≤25 and an
   active DCA, balance-empty, cap-6 + severity sort, zero-signal. Fabricated
   portfolio/market fixtures.
2. **Schema** (`personal-alerts-schema.test.ts`) — valid, drops bad enum, rejects
   empty/broken shape (mirrors ai-insights-schema tests).
3. **Fallback template** (`personal-alerts.test.ts`) — `templateAlerts(signals)`
   yields the right type/priority and number-bearing copy per `kind`, with no Groq
   dependency.

No live-network test of the Groq call; only the pure functions around it.

**Final verification:** `npm test` (unit) + `npm run build` green before done.
