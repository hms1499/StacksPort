# Crypto Bubbles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/bubbles` page that visualizes crypto market data as interactive canvas bubbles — size by market cap, color by price change, with Stacks tokens highlighted.

**Architecture:** API route proxies CoinGecko `/coins/markets` for top 50 + Stacks ecosystem tokens, returns unified `BubbleToken[]`. Client renders via HTML Canvas with circle packing, tooltip on click, timeframe toggle (1H/24H/7D). SWR auto-refreshes every 60s.

**Tech Stack:** Next.js 15 API route, SWR, HTML Canvas 2D, lucide-react, Tailwind CSS

---

### Task 1: API Route — `/api/bubbles`

**Files:**
- Create: `src/app/api/bubbles/route.ts`

- [ ] **Step 1: Create the API route**

```ts
// src/app/api/bubbles/route.ts
import { NextResponse } from "next/server";

const COINGECKO = "https://api.coingecko.com/api/v3";

const STACKS_TOKEN_IDS = [
  "blockstack",
  "alexgo",
  "welshcorgicoin",
  "velar",
  "staked-stx",
];

export interface BubbleToken {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change1h: number;
  change24h: number;
  change7d: number;
  isStacks: boolean;
}

function mapCoin(
  coin: Record<string, unknown>,
  forceStacks = false
): BubbleToken {
  return {
    id: coin.id as string,
    symbol: (coin.symbol as string).toUpperCase(),
    name: coin.name as string,
    image: coin.image as string,
    price: (coin.current_price as number) ?? 0,
    marketCap: (coin.market_cap as number) ?? 0,
    volume24h: (coin.total_volume as number) ?? 0,
    change1h: (coin.price_change_percentage_1h_in_currency as number) ?? 0,
    change24h: (coin.price_change_percentage_24h as number) ?? 0,
    change7d: (coin.price_change_percentage_7d_in_currency as number) ?? 0,
    isStacks: forceStacks || STACKS_TOKEN_IDS.includes(coin.id as string),
  };
}

export async function GET() {
  try {
    const topRes = await fetch(
      `${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=1h,7d`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
    );
    if (!topRes.ok) {
      return NextResponse.json(
        { error: "CoinGecko error" },
        { status: topRes.status }
      );
    }

    const topCoins: Record<string, unknown>[] = await topRes.json();
    const tokens: BubbleToken[] = topCoins.map((c) => mapCoin(c));

    const presentIds = new Set(tokens.map((t) => t.id));
    const missingStacks = STACKS_TOKEN_IDS.filter(
      (id) => !presentIds.has(id)
    );

    if (missingStacks.length > 0) {
      const ids = missingStacks.join(",");
      const stacksRes = await fetch(
        `${COINGECKO}/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false&price_change_percentage=1h,7d`,
        { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
      );
      if (stacksRes.ok) {
        const stacksCoins: Record<string, unknown>[] = await stacksRes.json();
        tokens.push(...stacksCoins.map((c) => mapCoin(c, true)));
      }
    }

    return NextResponse.json(tokens, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify the route works**

Run: `cd /Users/vanhuy/Desktop/StacksPort && npm run dev`

Then in another terminal:

```bash
curl -s http://localhost:3000/api/bubbles | head -c 500
```

Expected: JSON array of token objects with `id`, `symbol`, `price`, `marketCap`, `isStacks` fields.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bubbles/route.ts
git commit -m "feat(bubbles): add /api/bubbles proxy route for CoinGecko market data"
```

---

### Task 2: SWR Hook — `useBubblesData`

**Files:**
- Create: `src/hooks/useBubblesData.ts`

- [ ] **Step 1: Create the SWR hook**

```ts
// src/hooks/useBubblesData.ts
"use client";

import useSWR from "swr";
import type { BubbleToken } from "@/app/api/bubbles/route";

export type { BubbleToken };

async function fetchBubbles(): Promise<BubbleToken[]> {
  const res = await fetch("/api/bubbles");
  if (!res.ok) throw new Error("Failed to fetch bubbles");
  return res.json();
}

export function useBubblesData() {
  return useSWR<BubbleToken[]>("bubbles", fetchBubbles, {
    refreshInterval: 60_000,
    dedupingInterval: 30_000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useBubblesData.ts
git commit -m "feat(bubbles): add useBubblesData SWR hook"
```

---

### Task 3: TimeframeToggle Component

**Files:**
- Create: `src/components/bubbles/TimeframeToggle.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/bubbles/TimeframeToggle.tsx
"use client";

import { cn } from "@/lib/utils";

export type Timeframe = "1h" | "24h" | "7d";

const OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "1h", label: "1H" },
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
];

interface TimeframeToggleProps {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export default function TimeframeToggle({
  value,
  onChange,
}: TimeframeToggleProps) {
  return (
    <div className="flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--bg-card)" }}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200",
            value === opt.value
              ? "bg-[#408A71] text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bubbles/TimeframeToggle.tsx
git commit -m "feat(bubbles): add TimeframeToggle component"
```

---

### Task 4: BubbleTooltip Component

**Files:**
- Create: `src/components/bubbles/BubbleTooltip.tsx`

- [ ] **Step 1: Create the tooltip component**

```tsx
// src/components/bubbles/BubbleTooltip.tsx
"use client";

import { useEffect, useRef } from "react";
import type { BubbleToken } from "@/hooks/useBubblesData";
import type { Timeframe } from "./TimeframeToggle";

function fmtUsd(v: number): string {
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}T`;
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

function fmtPrice(v: number): string {
  if (v >= 1) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${v.toFixed(6)}`;
}

function getChange(token: BubbleToken, tf: Timeframe): number {
  if (tf === "1h") return token.change1h;
  if (tf === "7d") return token.change7d;
  return token.change24h;
}

interface BubbleTooltipProps {
  token: BubbleToken;
  x: number;
  y: number;
  timeframe: Timeframe;
  onClose: () => void;
}

export default function BubbleTooltip({
  token,
  x,
  y,
  timeframe,
  onClose,
}: BubbleTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Adjust position to keep tooltip within viewport
  const tooltipWidth = 200;
  const tooltipHeight = 160;
  let left = x + 12;
  let top = y - tooltipHeight / 2;

  if (typeof window !== "undefined") {
    if (left + tooltipWidth > window.innerWidth - 16) left = x - tooltipWidth - 12;
    if (top < 8) top = 8;
    if (top + tooltipHeight > window.innerHeight - 8) top = window.innerHeight - tooltipHeight - 8;
  }

  const change = getChange(token, timeframe);
  const isPositive = change >= 0;

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-xl border shadow-2xl p-3 min-w-[200px]"
      style={{
        left,
        top,
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={token.image} alt={token.symbol} className="w-6 h-6 rounded-full" />
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {token.name}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {token.symbol}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span style={{ color: "var(--text-muted)" }}>Price</span>
          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {fmtPrice(token.price)}
          </div>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>
            {timeframe.toUpperCase()}
          </span>
          <div
            className="font-semibold"
            style={{ color: isPositive ? "#34d399" : "#f87171" }}
          >
            {isPositive ? "+" : ""}
            {change.toFixed(1)}%
          </div>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>MCap</span>
          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {fmtUsd(token.marketCap)}
          </div>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Vol 24h</span>
          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {fmtUsd(token.volume24h)}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bubbles/BubbleTooltip.tsx
git commit -m "feat(bubbles): add BubbleTooltip component"
```

---

### Task 5: BubbleCanvas Component

**Files:**
- Create: `src/components/bubbles/BubbleCanvas.tsx`

This is the core rendering component. It handles circle packing layout, canvas drawing, and click detection.

- [ ] **Step 1: Create the canvas component**

```tsx
// src/components/bubbles/BubbleCanvas.tsx
"use client";

import { useRef, useEffect, useCallback } from "react";
import type { BubbleToken } from "@/hooks/useBubblesData";
import type { Timeframe } from "./TimeframeToggle";

const MIN_RADIUS = 20;
const MAX_RADIUS = 120;
const STACKS_BORDER_COLOR = "#408A71";
const POSITIVE_COLOR = "#34d399";
const NEGATIVE_COLOR = "#f87171";

interface LayoutBubble {
  token: BubbleToken;
  x: number;
  y: number;
  radius: number;
}

function getChange(token: BubbleToken, tf: Timeframe): number {
  if (tf === "1h") return token.change1h;
  if (tf === "7d") return token.change7d;
  return token.change24h;
}

function computeRadii(tokens: BubbleToken[]): number[] {
  if (tokens.length === 0) return [];
  const caps = tokens.map((t) => t.marketCap);
  const logMin = Math.log(Math.max(Math.min(...caps), 1));
  const logMax = Math.log(Math.max(...caps));
  const range = logMax - logMin || 1;
  return caps.map((cap) => {
    const norm = (Math.log(Math.max(cap, 1)) - logMin) / range;
    return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * norm;
  });
}

function packCircles(
  tokens: BubbleToken[],
  radii: number[],
  width: number,
  height: number
): LayoutBubble[] {
  const cx = width / 2;
  const cy = height / 2;
  const bubbles: LayoutBubble[] = [];

  // Sort by radius descending (largest first)
  const indices = radii.map((_, i) => i).sort((a, b) => radii[b] - radii[a]);

  for (const idx of indices) {
    const r = radii[idx];
    if (bubbles.length === 0) {
      bubbles.push({ token: tokens[idx], x: cx, y: cy, radius: r });
      continue;
    }

    // Try positions in expanding spiral from center
    let bestX = cx;
    let bestY = cy;
    let bestDist = Infinity;
    let placed = false;

    for (let angle = 0; angle < Math.PI * 20; angle += 0.3) {
      const dist = r + angle * 4;
      const tryX = cx + Math.cos(angle) * dist;
      const tryY = cy + Math.sin(angle) * dist;

      let overlaps = false;
      for (const b of bubbles) {
        const dx = tryX - b.x;
        const dy = tryY - b.y;
        if (Math.sqrt(dx * dx + dy * dy) < r + b.radius + 2) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        const d = Math.sqrt((tryX - cx) ** 2 + (tryY - cy) ** 2);
        if (d < bestDist) {
          bestDist = d;
          bestX = tryX;
          bestY = tryY;
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      // Fallback: place far from center
      bestX = cx + (Math.random() - 0.5) * width * 0.8;
      bestY = cy + (Math.random() - 0.5) * height * 0.8;
    }

    bubbles.push({ token: tokens[idx], x: bestX, y: bestY, radius: r });
  }

  return bubbles;
}

function drawBubbles(
  ctx: CanvasRenderingContext2D,
  bubbles: LayoutBubble[],
  timeframe: Timeframe,
  dpr: number
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const b of bubbles) {
    const change = getChange(b.token, timeframe);
    const isPositive = change >= 0;
    const color = isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR;
    const opacity = Math.min(0.1 + Math.abs(change) * 0.01, 0.35);

    ctx.save();

    // Glow for Stacks tokens
    if (b.token.isStacks) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(64,138,113,0.4)";
    }

    // Fill
    ctx.beginPath();
    ctx.arc(b.x * dpr, b.y * dpr, b.radius * dpr, 0, Math.PI * 2);
    ctx.fillStyle =
      color +
      Math.round(opacity * 255)
        .toString(16)
        .padStart(2, "0");
    ctx.fill();

    // Border
    ctx.strokeStyle = b.token.isStacks ? STACKS_BORDER_COLOR : color;
    ctx.lineWidth = (b.token.isStacks ? 3 : 1.5) * dpr;
    ctx.stroke();

    ctx.restore();

    // Symbol text
    const fontSize = Math.max(10, Math.min(b.radius * 0.35, 16));
    ctx.font = `bold ${fontSize * dpr}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = b.token.isStacks ? STACKS_BORDER_COLOR : "#f1f5f9";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.token.symbol, b.x * dpr, (b.y - fontSize * 0.3) * dpr);

    // Change % text
    const smallSize = Math.max(8, fontSize * 0.7);
    ctx.font = `${smallSize * dpr}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = color;
    const sign = isPositive ? "+" : "";
    ctx.fillText(
      `${sign}${change.toFixed(1)}%`,
      b.x * dpr,
      (b.y + fontSize * 0.5) * dpr
    );
  }
}

interface BubbleCanvasProps {
  tokens: BubbleToken[];
  timeframe: Timeframe;
  onBubbleClick: (token: BubbleToken, x: number, y: number) => void;
}

export default function BubbleCanvas({
  tokens,
  timeframe,
  onBubbleClick,
}: BubbleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<LayoutBubble[]>([]);

  const layout = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || tokens.length === 0) return;

    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const radii = computeRadii(tokens);
    bubblesRef.current = packCircles(tokens, radii, width, height);

    const ctx = canvas.getContext("2d");
    if (ctx) drawBubbles(ctx, bubblesRef.current, timeframe, dpr);
  }, [tokens, timeframe]);

  useEffect(() => {
    layout();
  }, [layout]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => layout());
    observer.observe(container);
    return () => observer.disconnect();
  }, [layout]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const b of bubblesRef.current) {
      const dx = mx - b.x;
      const dy = my - b.y;
      if (Math.sqrt(dx * dx + dy * dy) <= b.radius) {
        onBubbleClick(b.token, e.clientX, e.clientY);
        return;
      }
    }
  }

  return (
    <div ref={containerRef} className="w-full flex-1 min-h-[400px] relative">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="absolute inset-0 cursor-pointer"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bubbles/BubbleCanvas.tsx
git commit -m "feat(bubbles): add BubbleCanvas with circle packing and Canvas 2D rendering"
```

---

### Task 6: BubblesPageContent + Page Route

**Files:**
- Create: `src/components/bubbles/BubblesPageContent.tsx`
- Create: `src/app/bubbles/page.tsx`

- [ ] **Step 1: Create BubblesPageContent**

```tsx
// src/components/bubbles/BubblesPageContent.tsx
"use client";

import { useState, useCallback } from "react";
import { useBubblesData } from "@/hooks/useBubblesData";
import type { BubbleToken } from "@/hooks/useBubblesData";
import BubbleCanvas from "./BubbleCanvas";
import BubbleTooltip from "./BubbleTooltip";
import TimeframeToggle, { type Timeframe } from "./TimeframeToggle";

export default function BubblesPageContent() {
  const { data: tokens, isLoading, error } = useBubblesData();
  const [timeframe, setTimeframe] = useState<Timeframe>("24h");
  const [selected, setSelected] = useState<{
    token: BubbleToken;
    x: number;
    y: number;
  } | null>(null);

  const handleBubbleClick = useCallback(
    (token: BubbleToken, x: number, y: number) => {
      setSelected((prev) =>
        prev?.token.id === token.id ? null : { token, x, y }
      );
    },
    []
  );

  const handleCloseTooltip = useCallback(() => setSelected(null), []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <h1
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Crypto Bubbles
        </h1>
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative">
        {isLoading && !tokens && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
          </div>
        )}

        {error && !tokens && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Failed to load data. Retrying...
            </p>
          </div>
        )}

        {tokens && tokens.length > 0 && (
          <BubbleCanvas
            tokens={tokens}
            timeframe={timeframe}
            onBubbleClick={handleBubbleClick}
          />
        )}

        {selected && (
          <BubbleTooltip
            token={selected.token}
            x={selected.x}
            y={selected.y}
            timeframe={timeframe}
            onClose={handleCloseTooltip}
          />
        )}
      </div>

      {/* Stale data indicator */}
      {error && tokens && (
        <div
          className="px-4 py-1.5 text-center text-xs"
          style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)" }}
        >
          Data may be outdated
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the page route**

```tsx
// src/app/bubbles/page.tsx
import Topbar from "@/components/layout/Topbar";
import BubblesPageContent from "@/components/bubbles/BubblesPageContent";

export default function BubblesPage() {
  return (
    <div className="flex flex-col h-screen">
      <Topbar title="Bubbles" />
      <div className="flex-1 overflow-hidden">
        <BubblesPageContent />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/bubbles/BubblesPageContent.tsx src/app/bubbles/page.tsx
git commit -m "feat(bubbles): add BubblesPageContent and /bubbles page route"
```

---

### Task 7: Add Navigation Entry

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Update Sidebar**

In `src/components/layout/Sidebar.tsx`:

Add `Circle` to the lucide-react import:

```ts
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Bell,
  Repeat2,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Globe,
  Circle,
} from "lucide-react";
```

Add the Bubbles entry to the `navItems` array, after Dashboard:

```ts
const navItems = [
  { href: "/dashboard",     label: "Dashboard",  icon: LayoutDashboard },
  { href: "/bubbles",       label: "Bubbles",    icon: Circle },
  { href: "/assets",        label: "My Assets",  icon: Wallet },
  { href: "/trade",         label: "Swap",       icon: ArrowLeftRight },
  { href: "/dca",           label: "DCA Vault",  icon: Repeat2 },
  { href: "/notifications", label: "Alerts",     icon: Bell },
  { href: "/ai",            label: "Stacks AI",  icon: Sparkles },
  { href: "/apps",          label: "Connected Apps", icon: Globe },
];
```

- [ ] **Step 2: Update BottomNav**

In `src/components/layout/BottomNav.tsx`:

Add `Circle` to the lucide-react import:

```ts
import { LayoutDashboard, Wallet, ArrowLeftRight, Bell, Repeat2, Sparkles, Globe, Circle } from "lucide-react";
```

Add the Bubbles entry to the `navItems` array, after Home:

```ts
const navItems = [
  { href: "/dashboard",     label: "Home",    icon: LayoutDashboard },
  { href: "/bubbles",       label: "Bubbles", icon: Circle },
  { href: "/assets",        label: "Assets",  icon: Wallet },
  { href: "/trade",         label: "Swap",    icon: ArrowLeftRight },
  { href: "/dca",           label: "DCA",     icon: Repeat2 },
  { href: "/notifications", label: "Alerts",  icon: Bell },
  { href: "/ai",            label: "AI",      icon: Sparkles },
  { href: "/apps",          label: "Apps",    icon: Globe },
];
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/BottomNav.tsx
git commit -m "feat(bubbles): add Bubbles entry to sidebar and bottom nav"
```

---

### Task 8: Visual QA — Dev Server Testing

- [ ] **Step 1: Start dev server and open /bubbles**

```bash
cd /Users/vanhuy/Desktop/StacksPort && npm run dev
```

Open `http://localhost:3000/bubbles` in browser.

- [ ] **Step 2: Verify all features**

Check:
- Bubbles render with correct sizes (BTC largest)
- Color reflects price change (green = up, red = down)
- Stacks tokens (STX, ALEX, etc.) have green brand border with glow
- Timeframe toggle switches between 1H / 24H / 7D and updates colors
- Clicking a bubble shows tooltip with price, change, market cap, volume
- Clicking outside / pressing Escape dismisses tooltip
- Sidebar and bottom nav show "Bubbles" entry
- Page responsive on mobile viewport
- Data refreshes after 60 seconds

- [ ] **Step 3: Fix any issues found during QA**

Address any visual or functional issues discovered.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(bubbles): visual QA fixes"
```

---

### Task 9: Type Check & Lint

- [ ] **Step 1: Run type check**

```bash
cd /Users/vanhuy/Desktop/StacksPort && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -A
git commit -m "chore(bubbles): fix lint and type errors"
```
