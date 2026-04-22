# KOL Social Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `TrendAnalysisCard` with a `KOLSignalsCard` that shows top 10 coins by LunarCrush social score, with AI-generated insights via Groq.

**Architecture:** LunarCrush data is fetched server-side alongside existing CoinGecko/Fear&Greed/News fetches, injected into the Groq prompt, and returned as `kolSignals` in the existing `/api/ai/insights` response. Frontend swaps `TrendAnalysisCard` for `KOLSignalsCard`.

**Tech Stack:** Next.js 15, TypeScript, Groq SDK (llama-3.3-70b), LunarCrush API v4, SWR, Framer Motion, Tailwind CSS

---

### Task 1: Update types in `src/lib/ai.ts`

**Files:**
- Modify: `src/lib/ai.ts`

- [ ] **Step 1: Replace `TrendData` with `KOLSignalCoin` + `KOLSignalsData`, update `AIInsightsResponse`**

Replace entire file content:

```ts
// ─── AI Market Intelligence Types ────────────────────────────────────────────

export interface SentimentData {
  summary: string;
  score: number;          // -100 (bearish) to 100 (bullish)
  fearGreedValue: number;
  signals: { label: string; type: "bullish" | "bearish" | "neutral" }[];
}

export interface KOLSignalCoin {
  symbol: string;
  name: string;
  galaxyScore: number;          // 0–100, LunarCrush Galaxy Score
  socialVolume: number;         // 24h social post volume
  sentiment: "bullish" | "bearish" | "neutral";
  insight: string;              // 1-sentence Groq analysis
}

export interface KOLSignalsData {
  summary: string;              // 2-3 sentence overview from Groq
  coins: KOLSignalCoin[];
}

export interface AlertItem {
  title: string;
  description: string;
  type: "opportunity" | "warning" | "info";
  priority: "high" | "medium" | "low";
}

export interface NewsDigestItem {
  headline: string;
  insight: string;
  source: string;
  url: string;
}

export interface AIInsightsResponse {
  generatedAt: string;
  sentiment: SentimentData;
  kolSignals: KOLSignalsData;
  alerts: { items: AlertItem[] };
  newsDigest: {
    summary: string;
    items: NewsDigestItem[];
  };
}

export async function fetchAIInsights(): Promise<AIInsightsResponse> {
  const res = await fetch("/api/ai/insights");
  if (!res.ok) throw new Error("Failed to fetch AI insights");
  return res.json();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only in files that still reference `TrendData` (will fix in later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai.ts
git commit -m "feat: replace TrendData with KOLSignalsData types"
```

---

### Task 2: Update API route `src/app/api/ai/insights/route.ts`

**Files:**
- Modify: `src/app/api/ai/insights/route.ts`

- [ ] **Step 1: Add `LunarCrushCoin` interface and `fetchLunarCrushSignals()` after the `fetchNews()` function (around line 143)**

Insert after the closing brace of `fetchNews()`:

```ts
// ─── LunarCrush ──────────────────────────────────────────────────────────────

interface LunarCrushCoin {
  symbol: string;
  name: string;
  galaxy_score: number;
  social_volume_24h: number;
  price_change_24h: number;
}

async function fetchLunarCrushSignals(): Promise<LunarCrushCoin[]> {
  const apiKey = process.env.LUNARCRUSH_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(
      "https://lunarcrush.com/api4/public/coins/list/v2?sort=social_score&limit=10",
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? []).map((c: Record<string, unknown>) => ({
      symbol: String(c.symbol ?? ""),
      name: String(c.name ?? ""),
      galaxy_score: Number(c.galaxy_score ?? 0),
      social_volume_24h: Number(c.social_volume_24h ?? 0),
      price_change_24h: Number(c.price_change_24h ?? 0),
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Update `buildPrompt()` signature and body**

Change the function signature from:
```ts
function buildPrompt(market: MarketData, fearGreed: FearGreed, news: NewsItem[]): string {
```
to:
```ts
function buildPrompt(market: MarketData, fearGreed: FearGreed, news: NewsItem[], lunarcrushCoins: LunarCrushCoin[]): string {
```

Then inside the function, add `lunarSection` after the `newsText` variable definition:

```ts
  const lunarSection = lunarcrushCoins.length > 0
    ? `\n## Top Social Signals (LunarCrush)\n${lunarcrushCoins
        .map((c, i) =>
          `${i + 1}. ${c.symbol} (${c.name}) — Galaxy Score: ${c.galaxy_score}, Social Volume 24h: ${c.social_volume_24h.toLocaleString()}, Price 24h: ${c.price_change_24h >= 0 ? "+" : ""}${c.price_change_24h.toFixed(2)}%`
        )
        .join("\n")}`
    : "";
```

In the return template string, replace the `## Fear & Greed Index` section ending with:

```ts
## Fear & Greed Index
- Value: ${fearGreed.value}/100
- Classification: ${fearGreed.classification}
${lunarSection}
## Latest Crypto News
${newsText}
```

- [ ] **Step 3: Update Groq JSON schema in prompt — remove `trends`, add `kolSignals`**

In the return template string, replace the `"trends"` block:

```
  "trends": {
    "summary": "2-3 sentence trend analysis",
    "tokens": [
      {"symbol": "STX", "direction": "<up|down|sideways>", "insight": "1 sentence", "changePercent": ${market.stxChange24h.toFixed(2)}},
      {"symbol": "BTC", "direction": "<up|down|sideways>", "insight": "1 sentence", "changePercent": ${market.btcChange24h.toFixed(2)}}
    ]
  },
```

with:

```ts
  "kolSignals": {
    "summary": "2-3 sentence overview of which coins are gaining social momentum and why",
    "coins": [
      {"symbol": "STX", "name": "Stacks", "galaxyScore": 72, "socialVolume": 12400, "sentiment": "<bullish|bearish|neutral>", "insight": "1 sentence on social relevance"}
    ]
  },
```

Also update the Important instructions section — replace:
```
- Focus on Stacks (STX) ecosystem and Bitcoin (sBTC) relevance
```
with:
```
- Focus on Stacks (STX) ecosystem and Bitcoin (sBTC) relevance
- For kolSignals, include all coins from the LunarCrush data provided; if no LunarCrush data, return empty coins array
```

- [ ] **Step 4: Update `generateInsights()` signature and body**

Change signature from:
```ts
async function generateInsights(
  market: MarketData,
  fearGreed: FearGreed,
  news: NewsItem[]
): Promise<AIInsightsResponse> {
```
to:
```ts
async function generateInsights(
  market: MarketData,
  fearGreed: FearGreed,
  news: NewsItem[],
  lunarcrushCoins: LunarCrushCoin[]
): Promise<AIInsightsResponse> {
```

Update the `buildPrompt` call inside:
```ts
      content: buildPrompt(market, fearGreed, news, lunarcrushCoins),
```

Update the return object — replace `trends: parsed.trends` with `kolSignals: parsed.kolSignals ?? { summary: "", coins: [] }`:
```ts
  return {
    generatedAt: new Date().toISOString(),
    sentiment: parsed.sentiment,
    kolSignals: parsed.kolSignals ?? { summary: "", coins: [] },
    alerts: parsed.alerts,
    newsDigest: parsed.newsDigest,
  };
```

- [ ] **Step 5: Update GET handler to fetch LunarCrush and pass to `generateInsights`**

Replace:
```ts
    const [market, fearGreed, news] = await Promise.all([
      fetchMarketData(),
      fetchFearGreed(),
      fetchNews(),
    ]);

    const insights = await generateInsights(market, fearGreed, news);
```
with:
```ts
    const [market, fearGreed, news, lunarcrushCoins] = await Promise.all([
      fetchMarketData(),
      fetchFearGreed(),
      fetchNews(),
      fetchLunarCrushSignals(),
    ]);

    const insights = await generateInsights(market, fearGreed, news, lunarcrushCoins);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only in AI component files (will fix in later tasks).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/ai/insights/route.ts
git commit -m "feat: add LunarCrush social signals to AI insights API"
```

---

### Task 3: Create `KOLSignalsCard` component

**Files:**
- Create: `src/components/ai/KOLSignalsCard.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { Radio, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import type { KOLSignalsData } from "@/lib/ai";

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function galaxyColor(score: number): { bg: string; text: string } {
  if (score >= 70) return { bg: "rgba(0,229,160,0.12)", text: "#00E5A0" };
  if (score >= 40) return { bg: "rgba(251,191,36,0.12)", text: "#FBBF24" };
  return { bg: "rgba(248,113,113,0.12)", text: "#F87171" };
}

const sentimentConfig = {
  bullish:  { Icon: TrendingUp,   color: "#00E5A0", label: "↑" },
  bearish:  { Icon: TrendingDown, color: "#F87171", label: "↓" },
  neutral:  { Icon: ArrowRight,   color: "#94A3B8", label: "→" },
};

export default function KOLSignalsCard({ data }: { data: KOLSignalsData }) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio size={16} style={{ color: "var(--accent)" }} />
          <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            Social Signals
          </h3>
        </div>
        <span
          className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "rgba(99,102,241,0.1)", color: "#818CF8" }}
        >
          LunarCrush
        </span>
      </div>

      {/* Summary */}
      {data.summary && (
        <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
          {data.summary}
        </p>
      )}

      {/* Coins list */}
      {data.coins.length === 0 ? (
        <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
          No social data available
        </p>
      ) : (
        <div className="space-y-2">
          {data.coins.map((coin, i) => {
            const { bg, text } = galaxyColor(coin.galaxyScore);
            const { Icon, color } = sentimentConfig[coin.sentiment];
            return (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ backgroundColor: "var(--bg-elevated)" }}
              >
                {/* Sentiment icon */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <Icon size={14} style={{ color }} />
                </div>

                {/* Coin info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs" style={{ color: "var(--text-primary)" }}>
                      {coin.symbol}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {coin.name}
                    </span>
                    {/* Galaxy Score badge */}
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: bg, color: text }}
                    >
                      G {coin.galaxyScore}
                    </span>
                    {/* Social volume */}
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Vol {formatVolume(coin.socialVolume)}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                    {coin.insight}
                  </p>
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `KOLSignalsCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/KOLSignalsCard.tsx
git commit -m "feat: add KOLSignalsCard component with LunarCrush social data"
```

---

### Task 4: Update `AIPageContent.tsx` and delete `TrendAnalysisCard.tsx`

**Files:**
- Modify: `src/components/ai/AIPageContent.tsx`
- Delete: `src/components/ai/TrendAnalysisCard.tsx`

- [ ] **Step 1: Update `AIPageContent.tsx` — swap import and usage**

Replace:
```tsx
import TrendAnalysisCard from "./TrendAnalysisCard";
```
with:
```tsx
import KOLSignalsCard from "./KOLSignalsCard";
```

Replace usage:
```tsx
            <TrendAnalysisCard data={data.trends} />
```
with:
```tsx
            <KOLSignalsCard data={data.kolSignals} />
```

- [ ] **Step 2: Delete `TrendAnalysisCard.tsx`**

```bash
rm src/components/ai/TrendAnalysisCard.tsx
```

- [ ] **Step 3: Verify full TypeScript compile — no errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: clean compile (no output).

- [ ] **Step 4: Verify dev server starts without error**

```bash
npm run dev 2>&1 &
sleep 6
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ai
```

Expected: `200`

- [ ] **Step 5: Kill dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; echo "Port 3000 freed"
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ai/AIPageContent.tsx
git rm src/components/ai/TrendAnalysisCard.tsx
git commit -m "feat: swap TrendAnalysisCard for KOLSignalsCard on Stacks AI page"
```

---

### Task 5: Add `LUNARCRUSH_API_KEY` to environment

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add the key placeholder**

Append to `.env.local`:
```bash
# ── LunarCrush (social signals on /ai page) ──
# Get free key at: https://lunarcrush.com/developers
LUNARCRUSH_API_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add .env.local
git commit -m "chore: add LUNARCRUSH_API_KEY env placeholder"
```

> **Note for user:** Fill in `LUNARCRUSH_API_KEY` at https://lunarcrush.com/developers (free account). Without it the `kolSignals.coins` array will be empty and the card shows "No social data available".
