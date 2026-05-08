# Crypto Bubbles — Design Spec

## Overview

A new `/bubbles` page for StacksPort that visualizes crypto market data as interactive bubbles. Bubble size represents market cap, color represents price change (green = up, red = down). Stacks ecosystem tokens are visually highlighted. Users can toggle between 1H, 24H, and 7D timeframes and click bubbles to see detailed info.

## Data Flow

### API Route: `GET /api/bubbles?timeframe=1h|24h|7d`

Server-side proxy that merges two data sources:

1. **CoinGecko** `/coins/markets` — top 50 coins by market cap, includes price, market cap, volume, and % change for 1h/24h/7d
2. **Stacks ecosystem tokens** — if any of ALEX, Welsh, Velar, stSTX, USDCx are not in the top 50, append them via a second CoinGecko call using their gecko IDs

Response shape:

```ts
interface BubbleToken {
  id: string;           // CoinGecko ID
  symbol: string;       // e.g. "btc"
  name: string;         // e.g. "Bitcoin"
  image: string;        // CoinGecko icon URL
  price: number;        // current USD price
  marketCap: number;    // USD market cap
  volume24h: number;    // 24h trading volume USD
  change1h: number;     // % change 1h
  change24h: number;    // % change 24h
  change7d: number;     // % change 7d
  isStacks: boolean;    // true for Stacks ecosystem tokens
}
```

Caching: `next: { revalidate: 60 }` (1-minute ISR cache).

No database or server-side state required.

## Stacks Ecosystem Tokens

Tokens identified by CoinGecko ID:

```ts
const STACKS_TOKEN_IDS = [
  "blockstack",        // STX
  "alexgo",            // ALEX
  "welshcorgicoin",    // Welsh
  "velar",             // Velar
  "staked-stx",        // stSTX
];
```

Note: sBTC is not listed separately because it shares CoinGecko ID `"bitcoin"` with BTC. BTC already appears in the top 50 by market cap. sBTC is a wrapped representation of BTC on Stacks and does not have its own independent market cap or CoinGecko listing, so it is not shown as a separate bubble.

These tokens receive visual highlighting: thicker border (3px vs 1.5px), brand color `#408A71`, and a glow effect via canvas `shadowBlur`.

## Components & Files

```
src/app/bubbles/page.tsx                — Server component page wrapper
src/components/bubbles/
  BubblesPageContent.tsx                — Client component: canvas + tooltip + controls
  BubbleCanvas.tsx                      — Canvas renderer + circle packing algorithm
  BubbleTooltip.tsx                     — Tooltip overlay on bubble click
  TimeframeToggle.tsx                   — 1H / 24H / 7D toggle
src/hooks/useBubblesData.ts            — SWR hook for /api/bubbles
src/app/api/bubbles/route.ts           — API proxy route
```

### BubbleCanvas

Core rendering component. Responsibilities:

- Accepts `BubbleToken[]` and active `timeframe` as props
- Calculates circle packing layout: sort by market cap descending, place largest bubble at center, subsequent bubbles find nearest non-overlapping position to center
- Renders to a `<canvas>` element using 2D context
- Each bubble shows: token symbol (text) + % change (text), fill color with opacity based on change magnitude
- Stacks tokens: 3px border in `#408A71`, `shadowBlur: 12`, `shadowColor: rgba(64,138,113,0.4)`
- Non-Stacks tokens: 1.5px border in `#34d399` (positive) or `#f87171` (negative)
- Click detection: calculate distance from click coordinate to each bubble center, if within radius → emit `onBubbleClick(token, x, y)` callback
- Uses `requestAnimationFrame` for smooth rendering
- Responds to container resize via `ResizeObserver`

### BubbleTooltip

Positioned absolutely based on clicked bubble coordinates. Contents:

- Token icon (from CoinGecko `image` URL) + name + symbol
- Current price
- % change (for the active timeframe)
- Market cap (formatted, e.g. "$2.07T")
- Volume 24h (formatted)

Dismisses on: click outside, click different bubble, or Escape key. Auto-adjusts position when near viewport edges to prevent clipping.

### TimeframeToggle

Three buttons: 1H, 24H, 7D. Active button uses brand color `#408A71` background. Changing timeframe updates the `timeframe` query param passed to `useBubblesData` and re-renders bubble colors/opacity (no re-fetch needed — API returns all three change values).

### BubblesPageContent

Orchestrates the page:

- Calls `useBubblesData(timeframe)` to get token data
- Renders `TimeframeToggle` + `BubbleCanvas` + `BubbleTooltip`
- Manages selected bubble state and tooltip visibility
- Shows loading skeleton while data fetches

## Bubble Visual Encoding

| Property | Maps to |
|----------|---------|
| Size (radius) | Market cap — logarithmic scale, min 20px, max 120px |
| Fill color | Green `#34d399` (positive change) or Red `#f87171` (negative change) |
| Fill opacity | Magnitude of % change — larger change = more opaque (range 0.1–0.35) |
| Border | Stacks tokens: 3px `#408A71` with glow. Others: 1.5px matching fill color |
| Text | Symbol (bold, white) + % change value below |

Radius formula: `minRadius + (maxRadius - minRadius) * (log(marketCap) - log(minCap)) / (log(maxCap) - log(minCap))`

## Navigation

- Add "Bubbles" entry to sidebar navigation and mobile bottom nav
- Position: after Dashboard
- Icon: `Circle` from `lucide-react`

## Responsive Behavior

- Canvas resizes with container via `ResizeObserver`
- On mobile: tooltip renders below the canvas area instead of overlaying, to avoid being obscured by touch
- Timeframe toggle remains fully visible on mobile (3 compact buttons)

## Auto-Refresh

SWR `refreshInterval: 60_000` — data refreshes every 60 seconds. When new data arrives, bubble sizes and colors transition smoothly (recalculate layout, animate with `requestAnimationFrame`).

## Error Handling

- API route: if CoinGecko fails, return `{ error: "Failed to fetch data" }` with 500 status
- Client: SWR shows stale data on error with a subtle "Data may be outdated" indicator
- Individual token fetch failures (for Stacks tokens not in top 50): skip silently, show available data
