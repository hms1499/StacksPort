# KOL Social Signals — Design Spec

**Date:** 2026-04-22
**Scope:** Replace `TrendAnalysisCard` on the Stacks AI page with a `KOLSignalsCard` powered by LunarCrush social data + Groq analysis.

---

## Goal

Remove the static `TrendAnalysisCard` (STX/BTC price trend) and replace it with a dynamic **Social Signals** card that surfaces top trending crypto coins by social activity, with AI-generated insights for each.

---

## Data Flow

```
LunarCrush API
  GET /coins/list/v2?sort=social_score&limit=10
        ↓
fetchLunarCrushSignals()       [route.ts]
  → top 10 coins: symbol, name, galaxy_score,
    social_volume_24h, social_score, price_change_24h
        ↓
buildPrompt()
  → new "## Social Signals" section added to existing prompt
        ↓
Groq llama-3.3-70b
  → returns `kolSignals` field in JSON response
        ↓
AIInsightsResponse.kolSignals  [lib/ai.ts]
        ↓
KOLSignalsCard                 [components/ai/]
```

Cache: server-side 5 minutes (shared with existing `/api/ai/insights` cache).

---

## Types (`src/lib/ai.ts`)

Remove `TrendData`. Add:

```ts
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
  coins: KOLSignalCoin[];       // top coins by social score
}
```

`AIInsightsResponse`: replace `trends: TrendData` → `kolSignals: KOLSignalsData`.

---

## API Route (`src/app/api/ai/insights/route.ts`)

### New function: `fetchLunarCrushSignals()`

- Calls `https://lunarcrush.com/api4/public/coins/list/v2?sort=social_score&limit=10`
- Auth: `Authorization: Bearer ${process.env.LUNARCRUSH_API_KEY}`
- Timeout: 10s via `AbortSignal.timeout`
- On failure: returns empty array (graceful degradation — Groq will still run)
- Maps response to: `{ symbol, name, galaxy_score, social_volume_24h, price_change_24h }`

### Updated `buildPrompt()`

Adds section after Fear & Greed:

```
## Top Social Signals (LunarCrush)
1. BTC — Galaxy Score: 85, Social Volume 24h: 89200, Price 24h: +1.2%
2. STX — Galaxy Score: 72, Social Volume 24h: 12400, Price 24h: +3.4%
...
```

### Updated Groq JSON schema in prompt

Remove `trends` field. Add:

```json
"kolSignals": {
  "summary": "2-3 sentence overview of social momentum",
  "coins": [
    {
      "symbol": "STX",
      "name": "Stacks",
      "galaxyScore": 72,
      "socialVolume": 12400,
      "sentiment": "bullish",
      "insight": "1 sentence"
    }
  ]
}
```

### Updated `generateInsights()`

- Pass `lunarcrushCoins` to `buildPrompt()`
- Map `parsed.kolSignals` → `AIInsightsResponse.kolSignals`

---

## New Component: `KOLSignalsCard`

**File:** `src/components/ai/KOLSignalsCard.tsx`

Layout:
```
┌─────────────────────────────────────┐
│ 📡 Social Signals     [LunarCrush]  │
│ "{summary from Groq}"               │
│─────────────────────────────────────│
│ STX  Galaxy: 72  Vol: 12.4K   ↑    │
│      "Stacks gaining traction..."   │
│─────────────────────────────────────│
│ BTC  Galaxy: 85  Vol: 89.2K   →    │
│      "Bitcoin social flat..."       │
└─────────────────────────────────────┘
```

- **Galaxy Score badge**: green (≥70) / yellow (40–69) / red (<40)
- **Social Volume**: formatted as `12.4K`, `1.2M`
- **Sentiment icon + color**: ↑ green / → yellow / ↓ red
- **Footer**: small "Powered by LunarCrush" attribution

Props: `{ data: KOLSignalsData }`

---

## File Changes Summary

| File | Action |
|---|---|
| `src/lib/ai.ts` | Remove `TrendData`, add `KOLSignalsData` + `KOLSignalCoin` |
| `src/app/api/ai/insights/route.ts` | Add `fetchLunarCrushSignals()`, update prompt + response mapping |
| `src/components/ai/TrendAnalysisCard.tsx` | Delete |
| `src/components/ai/KOLSignalsCard.tsx` | Create |
| `src/components/ai/AIPageContent.tsx` | Swap import + usage |
| `.env.local` | Add `LUNARCRUSH_API_KEY` |

---

## Environment Variables

```bash
LUNARCRUSH_API_KEY=your_key_here   # https://lunarcrush.com/developers
```

---

## Error Handling

- LunarCrush unavailable → `fetchLunarCrushSignals()` returns `[]`, prompt section is omitted, Groq returns empty `kolSignals.coins`
- `LUNARCRUSH_API_KEY` missing → same graceful degradation
- Card shows "No social data available" when `coins` is empty
