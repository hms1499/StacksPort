# DCA Pre-Connect Backtest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a real "if you'd been DCA-ing for the last 12 months you'd hold X sBTC, Y% better than a lump sum" result on the disconnected dashboard to turn the empty acquisition surface into an activation hook.

**Architecture:** A pure simulation (`simulateBacktest`) consumes a historical STX/BTC daily price series and reuses the existing `computeLumpSum`. A server-only aggregator runs it once over a rolling 365-day window (cached via the underlying fetch's `revalidate 3600`). The dashboard server page awaits the result and renders a client widget that is shown only to disconnected visitors.

**Tech Stack:** Next.js 15 App Router (RSC), TypeScript, Zustand (`walletStore`), next-intl, vitest, CoinGecko via existing `getHistoricalStxBtcRange`.

**Spec:** `docs/superpowers/specs/2026-06-15-dca-backtest-preconnect-design.md`

**Conventions (this repo):** commit directly on `main`, no Co-Authored-By trailer, fine-grained commits each left green. Test command: `npx vitest run <file>`.

---

### Task 1: Pure backtest simulation

**Files:**
- Create: `src/lib/backtest.ts`
- Test: `src/lib/backtest.test.ts`

Reuses `computeLumpSum` and `LumpSumScenario` from `src/lib/dca.ts` (signature: `computeLumpSum({ totalStxIn, totalSbtcOut }, referenceDate, stxUsdAtRef, btcUsdAtRef) => LumpSumScenario | null`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/backtest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { simulateBacktest } from "./backtest";

// Build a daily YYYY-MM-DD price map starting 2025-01-01.
function series(
  days: { stxUsd: number; btcUsd: number }[],
): Map<string, { stxUsd: number; btcUsd: number }> {
  const m = new Map<string, { stxUsd: number; btcUsd: number }>();
  const start = Date.parse("2025-01-01T00:00:00Z");
  days.forEach((d, i) => {
    const iso = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    m.set(iso, d);
  });
  return m;
}

describe("simulateBacktest", () => {
  it("accumulates one buy per interval at the period price", () => {
    // 15 days, flat price stxUsd=2 btcUsd=100000. Weekly buys land on
    // day 0, 7, 14 → 3 swaps. Each buys 50*2/100000 = 0.001 sBTC.
    const prices = series(Array(15).fill({ stxUsd: 2, btcUsd: 100_000 }));
    const r = simulateBacktest(
      { amountStx: 50, intervalDays: 7, lookbackDays: 15 },
      prices,
    )!;
    expect(r.swaps).toBe(3);
    expect(r.totalStxIn).toBe(150);
    expect(r.totalSbtcOut).toBeCloseTo(0.003, 8);
    expect(r.startDate).toBe("2025-01-01");
    expect(r.currentValueUsd).toBeCloseTo(300, 6);
    // Flat price → DCA equals lump sum.
    expect(r.vsLump!.deltaPct).toBeCloseTo(0, 6);
  });

  it("reports a positive vs-lump delta when BTC falls after the start", () => {
    // Days 0-6 btc=100000, days 7-14 btc=50000 (stx flat=2).
    const days = Array.from({ length: 15 }, (_, i) => ({
      stxUsd: 2,
      btcUsd: i < 7 ? 100_000 : 50_000,
    }));
    const r = simulateBacktest(
      { amountStx: 50, intervalDays: 7, lookbackDays: 15 },
      series(days),
    )!;
    // Buys: day0 @100k → 0.001, day7 @50k → 0.002, day14 @50k → 0.002 = 0.005
    expect(r.totalSbtcOut).toBeCloseTo(0.005, 8);
    expect(r.vsLump!.deltaPct).toBeGreaterThan(0);
  });

  it("returns null when the series is too small to make a claim", () => {
    expect(simulateBacktest({ amountStx: 50, intervalDays: 7, lookbackDays: 15 }, new Map())).toBeNull();
    expect(
      simulateBacktest(
        { amountStx: 50, intervalDays: 7, lookbackDays: 15 },
        series([{ stxUsd: 2, btcUsd: 100_000 }]),
      ),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/backtest.test.ts`
Expected: FAIL — `Failed to resolve import "./backtest"` / `simulateBacktest is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/backtest.ts`:

```ts
// Pure DCA backtest over a historical STX/BTC daily price series. No I/O —
// the caller supplies the prices so this stays deterministic and unit-testable.
import { computeLumpSum, type LumpSumScenario } from "./dca";

export interface BacktestParams {
  amountStx: number;     // STX spent per interval
  intervalDays: number;  // cadence in days
  lookbackDays: number;  // window length (informational; the series defines the range)
}

export interface BacktestResult {
  totalStxIn: number;
  totalSbtcOut: number;
  swaps: number;
  startDate: string;        // YYYY-MM-DD of first buy
  currentBtcUsd: number;    // BTC/USD at the latest series point
  currentValueUsd: number;  // totalSbtcOut * currentBtcUsd
  vsLump: LumpSumScenario | null;
}

type Price = { stxUsd: number; btcUsd: number };

// Greatest date <= iso that has a price point (covers gaps/weekends in the feed).
function priceOnOrBefore(series: Map<string, Price>, iso: string): Price | undefined {
  let best: string | undefined;
  for (const d of series.keys()) {
    if (d <= iso && (best === undefined || d > best)) best = d;
  }
  return best ? series.get(best) : undefined;
}

export function simulateBacktest(
  params: BacktestParams,
  priceSeries: Map<string, Price>,
): BacktestResult | null {
  const dates = [...priceSeries.keys()].sort(); // ascending YYYY-MM-DD
  if (dates.length < 2) return null;

  const start = dates[0];
  const end = dates[dates.length - 1];
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  const stepMs = params.intervalDays * 86_400_000;

  let totalStxIn = 0;
  let totalSbtcOut = 0;
  let swaps = 0;
  let firstBuy: Price | null = null;

  for (let ms = startMs; ms <= endMs; ms += stepMs) {
    const iso = new Date(ms).toISOString().slice(0, 10);
    const price = priceSeries.get(iso) ?? priceOnOrBefore(priceSeries, iso);
    if (!price) continue;
    if (!firstBuy) firstBuy = price;
    totalSbtcOut += (params.amountStx * price.stxUsd) / price.btcUsd;
    totalStxIn += params.amountStx;
    swaps += 1;
  }

  if (swaps === 0 || totalStxIn <= 0 || !firstBuy) return null;

  const currentBtcUsd = priceSeries.get(end)!.btcUsd;
  const vsLump = computeLumpSum(
    { totalStxIn, totalSbtcOut },
    start,
    firstBuy.stxUsd,
    firstBuy.btcUsd,
  );

  return {
    totalStxIn,
    totalSbtcOut,
    swaps,
    startDate: start,
    currentBtcUsd,
    currentValueUsd: totalSbtcOut * currentBtcUsd,
    vsLump,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/backtest.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/backtest.ts src/lib/backtest.test.ts
git commit -m "feat(backtest): pure DCA backtest simulation over a price series"
```

---

### Task 2: Server-only backtest snapshot

**Files:**
- Create: `src/lib/server/backtest-snapshot.ts`

Reuses `getHistoricalStxBtcRange(days)` from `src/lib/stacks.ts` (returns `Map<string, { stxUsd; btcUsd }>`, two CoinGecko calls, each with `next: { revalidate: 3600 }` — so this aggregator needs no extra cache wrapper).

- [ ] **Step 1: Write the implementation**

Create `src/lib/server/backtest-snapshot.ts`:

```ts
// Server-only aggregator: runs the fixed showcase backtest over a rolling
// 365-day window. Consumed by the dashboard RSC only. Caching is inherited
// from getHistoricalStxBtcRange's per-fetch revalidate (3600s) plus the
// dashboard page's revalidate.
import { getHistoricalStxBtcRange } from "@/lib/stacks";
import { simulateBacktest, type BacktestResult } from "@/lib/backtest";

// Fixed pre-connect showcase. Re-tune the pitch by editing this one object.
const SHOWCASE = { amountStx: 50, intervalDays: 7, lookbackDays: 365 } as const;

export type { BacktestResult };

export async function getBacktestSnapshot(): Promise<BacktestResult | null> {
  // E2E runs short-circuit so disconnected-dashboard tests stay deterministic
  // (no live CoinGecko dependency; the widget renders nothing).
  if (process.env.E2E === "1") return null;

  const series = await getHistoricalStxBtcRange(SHOWCASE.lookbackDays);
  return simulateBacktest(SHOWCASE, series);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `backtest-snapshot.ts`. (If the project's `tsc --noEmit` is noisy with unrelated pre-existing errors, instead confirm via the build in Task 5; this file only imports already-typed symbols.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/backtest-snapshot.ts
git commit -m "feat(backtest): server snapshot for the fixed 12-month showcase"
```

---

### Task 3: i18n keys for the widget (all four catalogs)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/vi.json`
- Modify: `messages/zh.json`
- Modify: `messages/ja.json`
- Test: `src/i18n/messages.test.ts` (existing parity test — no edit, used as the gate)

The anchor `"dashboard": {\n    "balance": {` is identical in all four files; insert `backtest` as the first key of `dashboard`.

- [ ] **Step 1: Add the key block to `messages/en.json`**

Replace:

```json
  "dashboard": {
    "balance": {
```

with:

```json
  "dashboard": {
    "backtest": {
      "eyebrow": "If you'd been stacking",
      "scenario": "{stx} STX every week · last 12 months",
      "sbtcLabel": "sBTC accumulated",
      "valueLabel": "Worth today",
      "vsLumpLabel": "vs. one-time buy",
      "cta": "Start your plan",
      "disclaimer": "Based on real STX/BTC prices over the last 12 months. Past performance does not guarantee future results."
    },
    "balance": {
```

- [ ] **Step 2: Add the key block to `messages/vi.json`**

Replace:

```json
  "dashboard": {
    "balance": {
```

with:

```json
  "dashboard": {
    "backtest": {
      "eyebrow": "Nếu bạn đã tích luỹ đều đặn",
      "scenario": "{stx} STX mỗi tuần · 12 tháng qua",
      "sbtcLabel": "sBTC tích luỹ",
      "valueLabel": "Giá trị hôm nay",
      "vsLumpLabel": "so với mua một lần",
      "cta": "Bắt đầu kế hoạch của bạn",
      "disclaimer": "Dựa trên giá STX/BTC thực tế trong 12 tháng qua. Hiệu suất quá khứ không đảm bảo kết quả tương lai."
    },
    "balance": {
```

- [ ] **Step 3: Add the key block to `messages/zh.json`**

Replace:

```json
  "dashboard": {
    "balance": {
```

with:

```json
  "dashboard": {
    "backtest": {
      "eyebrow": "如果你一直在定投",
      "scenario": "每周 {stx} STX · 过去 12 个月",
      "sbtcLabel": "累计 sBTC",
      "valueLabel": "当前价值",
      "vsLumpLabel": "对比一次性买入",
      "cta": "开始你的计划",
      "disclaimer": "基于过去 12 个月真实的 STX/BTC 价格。过往表现不代表未来收益。"
    },
    "balance": {
```

- [ ] **Step 4: Add the key block to `messages/ja.json`**

Replace:

```json
  "dashboard": {
    "balance": {
```

with:

```json
  "dashboard": {
    "backtest": {
      "eyebrow": "もし積み立てを続けていたら",
      "scenario": "毎週 {stx} STX · 過去12か月",
      "sbtcLabel": "積み立てたsBTC",
      "valueLabel": "現在の価値",
      "vsLumpLabel": "一括購入との比較",
      "cta": "プランを始める",
      "disclaimer": "過去12か月の実際のSTX/BTC価格に基づきます。過去の実績は将来の成果を保証しません。"
    },
    "balance": {
```

- [ ] **Step 5: Run the parity test to verify all four catalogs stay key-for-key identical**

Run: `npx vitest run src/i18n/messages.test.ts`
Expected: PASS (6 tests) — vi/zh/ja each have every en key and no extras.

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/vi.json messages/zh.json messages/ja.json
git commit -m "feat(i18n): add dashboard.backtest copy in en/vi/zh/ja"
```

---

### Task 4: Disconnected-only client widget

**Files:**
- Create: `src/components/dashboard/DcaBacktestHero.tsx`

Uses `useWalletStore()` (`{ isConnected, connect }`) and `connectWallet(connect)` from `@/lib/wallet` (same pattern as `src/components/wallet/ConnectWalletCTA.tsx`). CSS vars confirmed in `globals.css`: `--accent`, `--accent-glow`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-subtle`, `--positive`, `--negative`.

- [ ] **Step 1: Write the component**

Create `src/components/dashboard/DcaBacktestHero.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp, Zap, Loader2 } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { connectWallet } from "@/lib/wallet";
import type { BacktestResult } from "@/lib/server/backtest-snapshot";

interface Props {
  backtest: BacktestResult | null;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-base font-bold" style={{ color: accent ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

export default function DcaBacktestHero({ backtest }: Props) {
  const t = useTranslations("dashboard.backtest");
  const { isConnected, connect } = useWalletStore();
  const [connecting, setConnecting] = useState(false);

  // Value only for not-yet-connected visitors; hidden once a wallet is on,
  // or when the backtest data is unavailable (never show a broken/empty widget).
  if (isConnected || !backtest || !backtest.vsLump) return null;

  const deltaPct = backtest.vsLump.deltaPct;
  const positive = deltaPct >= 0;

  async function handleConnect() {
    setConnecting(true);
    try {
      await connectWallet(connect);
    } catch {
      // user cancelled
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div
      className="glass-card rounded-2xl p-5 md:p-6 shadow-sm mb-4 md:mb-5"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={15} style={{ color: "var(--accent)" }} />
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          {t("eyebrow")}
        </span>
      </div>

      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        {t("scenario", { stx: 50 })}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label={t("sbtcLabel")} value={`${backtest.totalSbtcOut.toFixed(4)} sBTC`} />
        <Stat label={t("valueLabel")} value={`$${Math.round(backtest.currentValueUsd).toLocaleString()}`} />
        <Stat
          label={t("vsLumpLabel")}
          value={`${positive ? "+" : ""}${deltaPct.toFixed(1)}%`}
          accent={positive ? "var(--positive)" : "var(--negative)"}
        />
      </div>

      <button
        onClick={handleConnect}
        disabled={connecting}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--accent)",
          boxShadow: connecting ? "none" : "0 0 16px var(--accent-glow)",
        }}
      >
        {connecting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
        {t("cta")}
      </button>

      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
        {t("disclaimer")}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `DcaBacktestHero.tsx`. (If `tsc --noEmit` is noisy with unrelated errors, defer to the Task 5 build.)

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DcaBacktestHero.tsx
git commit -m "feat(dashboard): pre-connect DCA backtest hero widget"
```

---

### Task 5: Wire into the dashboard page + verify

**Files:**
- Modify: `src/app/[locale]/dashboard/page.tsx`

Current relevant body (after the earlier i18n fix):

```tsx
  const marketSnapshot = await getMarketSnapshot();
  const t = await getTranslations("nav");

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title={t("home")} />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <DashboardGridClient marketSnapshot={marketSnapshot} />
        <DashboardFooter />
      </AnimatedPage>
    </div>
  );
```

- [ ] **Step 1: Add imports**

Add these two imports alongside the existing imports at the top of the file:

```tsx
import DcaBacktestHero from "@/components/dashboard/DcaBacktestHero";
import { getBacktestSnapshot } from "@/lib/server/backtest-snapshot";
```

- [ ] **Step 2: Await the snapshot and render the widget at the top of the content**

Replace:

```tsx
  const marketSnapshot = await getMarketSnapshot();
  const t = await getTranslations("nav");

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title={t("home")} />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <DashboardGridClient marketSnapshot={marketSnapshot} />
        <DashboardFooter />
      </AnimatedPage>
    </div>
  );
```

with:

```tsx
  const marketSnapshot = await getMarketSnapshot();
  const backtest = await getBacktestSnapshot();
  const t = await getTranslations("nav");

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title={t("home")} />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <DcaBacktestHero backtest={backtest} />
        <DashboardGridClient marketSnapshot={marketSnapshot} />
        <DashboardFooter />
      </AnimatedPage>
    </div>
  );
```

- [ ] **Step 3: Run the unit + parity suites**

Run: `npx vitest run src/lib/backtest.test.ts src/i18n/messages.test.ts`
Expected: PASS (3 + 6 tests).

- [ ] **Step 4: Production build (dev server MUST be stopped first)**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; rm -rf .next; npm run build
```
Expected: `BUILD_EXIT=0`, `✓ Compiled successfully`, `✓ Generating static pages`. (Building with the dev server running triggers a phantom "Cannot find module for page" `.next` race — always stop it first.)

- [ ] **Step 5: Browser verify (disconnected) — optional but recommended**

```bash
npm run dev   # then open http://localhost:3000/dashboard
```
Confirm: the backtest hero appears above the grid while no wallet is connected, shows non-zero sBTC / USD value / a vs-lump %, and the "Start your plan" button opens the wallet connect flow. When `GROQ`/network is unavailable locally and CoinGecko returns no data, the widget correctly renders nothing (no broken card). Stop the dev server and free port 3000 when done: `lsof -ti:3000 | xargs kill -9`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/dashboard/page.tsx"
git commit -m "feat(dashboard): render pre-connect backtest hero above the grid"
```

---

## Self-Review Notes

- **Spec coverage:** units 1–4 → Tasks 1, 2, 4, 5; data freshness (revalidate 3600 inherited) → Task 2; fixed scenario constant → Task 2 `SHOWCASE`; client connection gate → Task 4 (`isConnected` early return); fail-invisible → Task 4 (`!backtest || !backtest.vsLump`) and Task 2 (null on empty series); i18n parity → Task 3. All covered.
- **Type consistency:** `BacktestResult` / `BacktestParams` defined in Task 1, re-exported from Task 2, consumed in Task 4. `computeLumpSum` arg shape (`{ totalStxIn, totalSbtcOut }`) matches `src/lib/dca.ts`. `vsLump.deltaPct` field matches `LumpSumScenario`.
- **Placeholders:** none — every step has complete code or an exact command.
- **Deviation from spec:** widget is placed at the top of the dashboard content (above the grid, which contains the connect banner) rather than literally "below the banner" — the banner lives inside the client `DashboardGrid`, and top-of-content keeps the change self-contained while still filling the empty disconnected space prominently. Intent preserved.
