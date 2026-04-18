# DCA Tab Full Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the DCA tab (In & Out) into a DeFi-modern Hero+Dashboard layout with dual-gradient theming, a hybrid plan-card pattern, and a live-preview create form — keeping motion subtle and mobile-first.

**Architecture:** Split the current monolithic `DCAPageContent` into focused sub-components (`DCAHeroSection`, `DCAHeroStats`, `LivePreviewCard`, `PlanCardRow`, `PlanCardExpanded`, tabbed inner views, `InfoFooter`). Introduce new CSS tokens (`--dca-in-*`, `--dca-out-*`) and utility classes (`.gradient-dca-in`, `.gradient-border-*`) in `globals.css`. Refactor `dca-out` mirror structure in lockstep.

**Tech Stack:** Next.js 15 + React 19 + TypeScript, Tailwind v4, framer-motion 12, lucide-react, Playwright e2e, existing CSS-var design system ("Deep Cosmos").

**Spec reference:** `docs/superpowers/specs/2026-04-18-dca-tab-full-redesign-design.md`

**Testing strategy:** This project only has Playwright e2e tests (no unit-test framework). For each task that changes user-visible behavior: update / add the e2e expectation first, verify it fails, implement, verify it passes, commit. For pure styling / token tasks where e2e gives no signal, follow: implement → manual browser check → commit.

**Dev server reminder:** Run `npm run dev` and visit `http://localhost:3000/dca` to verify visual changes at the end of every task. The existing system prompt requires browser verification before claiming UI work is done.

---

## Task 1: Add design tokens + utility classes to globals.css

**Files:**
- Modify: `src/app/globals.css` (append after line 60, inside and after the existing `.dark` block)

**Context:** The spec defines new CSS variables for dual gradients and 4 utility classes. These are consumed by every subsequent task, so land them first.

- [ ] **Step 1: Add `--dca-in-*` / `--dca-out-*` / `--hero-bg-*` / `--shadow-card*` tokens to `:root`**

Edit `src/app/globals.css`. Inside the `:root { ... }` block (around line 8-33), after the line `--warning:  #F59E0B;`, add the following before the closing `}`:

```css
  /* DCA dual-gradient tokens */
  --dca-in-from:   #00C27A;
  --dca-in-to:     #06B6D4;
  --dca-in-glow:   rgba(6, 182, 212, 0.25);

  --dca-out-from:  #F59E0B;
  --dca-out-to:    #EC4899;
  --dca-out-glow:  rgba(236, 72, 153, 0.22);

  --hero-bg-dca-in:  radial-gradient(ellipse 100% 80% at 50% 0%,
                       rgba(0, 194, 122, 0.12) 0%,
                       rgba(6, 182, 212, 0.08) 50%,
                       transparent 100%);
  --hero-bg-dca-out: radial-gradient(ellipse 100% 80% at 50% 0%,
                       rgba(245, 158, 11, 0.10) 0%,
                       rgba(236, 72, 153, 0.08) 50%,
                       transparent 100%);

  --shadow-card:       0 1px 3px rgba(10, 22, 40, 0.04);
  --shadow-card-hover: 0 8px 24px rgba(10, 22, 40, 0.08);
```

- [ ] **Step 2: Add dark-mode overrides to `.dark` block**

Inside the `.dark { ... }` block (around line 35-60), after the line `--warning:  #FBBF24;`, add before the closing `}`:

```css
  /* DCA dual-gradient tokens — dark overrides */
  --dca-in-from:   #00E5A0;
  --dca-in-to:     #22D3EE;
  --dca-in-glow:   rgba(34, 211, 238, 0.28);

  --dca-out-from:  #FBBF24;
  --dca-out-to:    #F472B6;
  --dca-out-glow:  rgba(244, 114, 182, 0.28);

  --hero-bg-dca-in:  radial-gradient(ellipse 100% 80% at 50% 0%,
                       rgba(0, 229, 160, 0.10) 0%,
                       rgba(34, 211, 238, 0.06) 50%,
                       transparent 100%);
  --hero-bg-dca-out: radial-gradient(ellipse 100% 80% at 50% 0%,
                       rgba(251, 191, 36, 0.08) 0%,
                       rgba(244, 114, 182, 0.06) 50%,
                       transparent 100%);

  --shadow-card:       0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-card-hover: 0 8px 24px rgba(0, 0, 0, 0.4);
```

- [ ] **Step 3: Append gradient utility classes to the GLOW + GLASS UTILITIES section**

Locate the line `.glass-card { ... }` block (around line 116-125). After the existing `.dark .glass-card` rule, append:

```css
/* ══════════════════════════════════════════════════════
   DCA DUAL-GRADIENT UTILITIES
══════════════════════════════════════════════════════ */
.gradient-dca-in  { background: linear-gradient(135deg, var(--dca-in-from),  var(--dca-in-to)); }
.gradient-dca-out { background: linear-gradient(135deg, var(--dca-out-from), var(--dca-out-to)); }

.gradient-text-dca-in {
  background: linear-gradient(135deg, var(--dca-in-from), var(--dca-in-to));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.gradient-text-dca-out {
  background: linear-gradient(135deg, var(--dca-out-from), var(--dca-out-to));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.gradient-border-dca-in {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--bg-card), var(--bg-card)) padding-box,
    linear-gradient(135deg, var(--dca-in-from), var(--dca-in-to)) border-box;
}
.gradient-border-dca-out {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--bg-card), var(--bg-card)) padding-box,
    linear-gradient(135deg, var(--dca-out-from), var(--dca-out-to)) border-box;
}

.glow-dca-in  { box-shadow: 0 0 24px var(--dca-in-glow); }
.glow-dca-out { box-shadow: 0 0 24px var(--dca-out-glow); }

.hero-bg-dca-in  { background-image: var(--hero-bg-dca-in); }
.hero-bg-dca-out { background-image: var(--hero-bg-dca-out); }
```

- [ ] **Step 4: Verify CSS compiles**

Run: `npm run lint && npm run build 2>&1 | tail -20`
Expected: Build succeeds. No CSS syntax errors.

- [ ] **Step 5: Sanity-check in browser**

Run: `npm run dev`
Open: `http://localhost:3000/dca`
Expected: Page renders the same as before (no visual regressions — tokens are not consumed yet).

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(dca): add dual-gradient design tokens and utility classes"
```

---

## Task 2: Extract shared pool-quote helper

**Files:**
- Create: `src/lib/dca-quote.ts`
- Modify: `src/components/dca/PlanCard.tsx` (lines 57-107 — replace inline fetch with helper call; leave rest of file untouched for now)

**Context:** `PlanCard.tsx` currently inlines a 50-line pool-quote fetch against Bitflow's `xyk-core-v-1-2/get-dx`. The new `LivePreviewCard` needs the same quote with different inputs. Extract the helper now so both can share it.

- [ ] **Step 1: Create `src/lib/dca-quote.ts` with the extracted helper**

```ts
// src/lib/dca-quote.ts
// Shared sBTC pool-quote helper against Bitflow xyk-core get-dx.
// Used by PlanCard (execute) and LivePreviewCard (estimate before creation).

const POOL_CONTRACT = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1";
const SBTC_TOKEN    = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const STX_TOKEN     = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2";
const GET_DX_URL    =
  "https://api.hiro.so/v2/contracts/call-read/SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR/xyk-core-v-1-2/get-dx";

function splitCid(cid: string): [string, string] {
  const [addr, name] = cid.split(".");
  return [addr, name];
}

/**
 * Quote sBTC output for a given net uSTX input (micro-STX after 0.3% vault fee).
 * Returns sBTC amount in normal units (1 sBTC = 1e8 sats).
 * Throws on no-liquidity or network failure.
 */
export async function quoteSbtcForUstx(netUstx: number): Promise<number> {
  const { contractPrincipalCV, uintCV, serializeCV, hexToCV } = await import("@stacks/transactions");

  const toHex = (cv: unknown) => {
    const bytes = serializeCV(cv as Parameters<typeof serializeCV>[0]);
    const hex = typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("hex");
    return "0x" + hex;
  };

  const [poolAddr, poolName] = splitCid(POOL_CONTRACT);
  const [sbtcAddr, sbtcName] = splitCid(SBTC_TOKEN);
  const [stxAddr,  stxName]  = splitCid(STX_TOKEN);

  const args = [
    toHex(contractPrincipalCV(poolAddr, poolName)),
    toHex(contractPrincipalCV(sbtcAddr, sbtcName)),
    toHex(contractPrincipalCV(stxAddr, stxName)),
    toHex(uintCV(netUstx)),
  ];

  const res = await fetch(GET_DX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender: "SP000000000000000000002Q6VF78", arguments: args }),
  });
  const data = await res.json();
  if (!data.okay) throw new Error(data.cause ?? "get-dx failed");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cv = hexToCV(data.result) as any;
  const sats = Number(cv?.value?.value ?? cv?.value ?? 0);
  if (!sats || sats <= 0) throw new Error("No liquidity in pool");
  return sats / 1e8;
}

/**
 * Apply the 0.3% vault protocol fee to a gross uSTX amount.
 * Returns the net uSTX that will actually reach the router.
 */
export function netUstxAfterFee(grossUstx: number): number {
  return grossUstx - Math.floor(grossUstx * 30 / 10000);
}
```

- [ ] **Step 2: Replace the inline fetch in `PlanCard.tsx` with the helper**

Open `src/components/dca/PlanCard.tsx`. Add to the top-of-file imports (alongside the existing dca imports):

```ts
import { quoteSbtcForUstx, netUstxAfterFee } from "@/lib/dca-quote";
```

Locate the line `const netUstx = plan.amt - Math.floor(plan.amt * 30 / 10000);` (around line 53) and replace with:

```ts
const netUstx = netUstxAfterFee(plan.amt);
```

Locate the `useEffect` block starting `useEffect(() => { if (!expanded || !canExecuteNow) return; ...` (around lines 57–107). Replace the entire block with:

```ts
  useEffect(() => {
    if (!expanded || !canExecuteNow) return;
    setQuoteLoading(true);
    setQuoteError(null);
    setQuotedSbtc(null);

    quoteSbtcForUstx(netUstx)
      .then((sbtc) => setQuotedSbtc(sbtc))
      .catch((e: Error) => setQuoteError(e.message ?? "Failed to get quote"))
      .finally(() => setQuoteLoading(false));
  }, [expanded, canExecuteNow, netUstx]);
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Run existing e2e tests to confirm no regression**

Run: `npm run test:e2e -- e2e/dca.spec.ts 2>&1 | tail -30`
Expected: All tests still pass (behavior unchanged — just refactored).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dca-quote.ts src/components/dca/PlanCard.tsx
git commit -m "refactor(dca): extract pool-quote helper into dca-quote module"
```

---

## Task 3: Create shared preview-calculation helpers

**Files:**
- Create: `src/lib/dca-preview.ts`

**Context:** LivePreviewCard, Hero next-swap countdown, and plan-card row all need small calculation helpers (swaps count, end-date estimate, block-countdown formatting). Centralize.

- [ ] **Step 1: Create `src/lib/dca-preview.ts`**

```ts
// src/lib/dca-preview.ts
// Pure helpers for DCA preview calculations — used by LivePreviewCard,
// DCAHeroStats, and PlanCardRow. No side effects, no React.

import { INTERVALS, blocksToInterval } from "./dca";

const STACKS_BLOCK_SECONDS = 600; // ~10 min target (Nakamoto); rough ETA use only

/**
 * Number of swaps the plan can afford given deposit and per-swap amount.
 * Returns 0 if inputs are invalid.
 */
export function swapsCount(depositStx: number, amountStx: number): number {
  if (amountStx <= 0 || depositStx < amountStx) return 0;
  return Math.floor(depositStx / amountStx);
}

/**
 * Estimated calendar end-date for a DCA plan.
 * Returns a Date that is `swaps * intervalBlocks * 10min` from now, or null on invalid.
 */
export function estimateEndDate(
  depositStx: number,
  amountStx: number,
  intervalKey: keyof typeof INTERVALS,
): Date | null {
  const swaps = swapsCount(depositStx, amountStx);
  if (swaps <= 0) return null;
  const blocks = INTERVALS[intervalKey];
  const seconds = swaps * blocks * STACKS_BLOCK_SECONDS;
  return new Date(Date.now() + seconds * 1000);
}

/**
 * Total protocol fee (in STX) across all planned swaps = swaps × amount × 0.3%.
 */
export function totalProtocolFee(depositStx: number, amountStx: number): number {
  const swaps = swapsCount(depositStx, amountStx);
  return swaps * amountStx * 0.003;
}

/**
 * Short human-readable countdown for blocks remaining.
 * e.g. 0 → "Ready", 1 → "~10m", 30 → "~5h", 200 → "~33h", 1500 → "~10d".
 */
export function formatBlocksCountdown(blocks: number): string {
  if (blocks <= 0) return "Ready";
  const mins = blocks * 10;
  if (mins < 60)  return `~${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `~${hours}h`;
  const days = Math.round(hours / 24);
  return `~${days}d`;
}

/**
 * Pick the shortest countdown across a user's active plans.
 * Returns null if no active plans with remaining swaps.
 */
export function nextSwapCountdown(
  plans: Array<{ active: boolean; leb: number; ivl: number; bal: number; amt: number }>,
  currentBlock: number,
): string | null {
  const remaining = plans
    .filter((p) => p.active && p.bal >= p.amt && p.amt > 0)
    .map((p) => {
      const nextBlock = p.leb === 0 ? currentBlock : p.leb + p.ivl;
      return Math.max(0, nextBlock - currentBlock);
    });
  if (remaining.length === 0) return null;
  return formatBlocksCountdown(Math.min(...remaining));
}

export { blocksToInterval };
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dca-preview.ts
git commit -m "feat(dca): add preview calculation helpers for form and hero"
```

---

## Task 4: LivePreviewCard component

**Files:**
- Create: `src/components/dca/LivePreviewCard.tsx`

**Context:** A presentational card that shows swap count, end date, estimated output, and total fee. Accepts `mode="in" | "out"` to flip gradient and currency labels. Reused by both In and Out create forms.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { Info, AlertTriangle } from "lucide-react";
import { INTERVALS } from "@/lib/dca";
import {
  swapsCount,
  estimateEndDate,
  totalProtocolFee,
} from "@/lib/dca-preview";

type Mode = "in" | "out";

interface LivePreviewCardProps {
  mode: Mode;
  amountStx: number;       // for "in": STX per swap; for "out": sBTC per swap (reuse unit-agnostic calc)
  depositStx: number;      // initial deposit
  intervalKey: keyof typeof INTERVALS;
  estimatedOutput: number | null;  // sBTC (in-mode) or USDCx (out-mode), or null when not quoted
  outputLabel: string;             // e.g. "sBTC" or "USDCx"
  inputLabel: string;              // e.g. "STX" or "sBTC"
  invalidReason?: string | null;   // if set, render as warning card
}

export default function LivePreviewCard({
  mode,
  amountStx,
  depositStx,
  intervalKey,
  estimatedOutput,
  outputLabel,
  inputLabel,
  invalidReason,
}: LivePreviewCardProps) {
  const swaps = swapsCount(depositStx, amountStx);
  const endDate = estimateEndDate(depositStx, amountStx, intervalKey);
  const fee = totalProtocolFee(depositStx, amountStx);

  if (invalidReason) {
    return (
      <div
        className="rounded-2xl p-4 flex items-start gap-2"
        style={{ border: `1px solid var(--warning)`, background: "var(--bg-elevated)" }}
      >
        <AlertTriangle size={14} style={{ color: "var(--warning)" }} className="mt-0.5 shrink-0" />
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{invalidReason}</p>
      </div>
    );
  }

  if (swaps <= 0) return null;

  const borderClass = mode === "in" ? "gradient-border-dca-in" : "gradient-border-dca-out";

  return (
    <div className={`${borderClass} rounded-2xl p-4 flex flex-col gap-2`}>
      <div className="flex items-center gap-1.5">
        <Info size={12} style={{ color: "var(--text-muted)" }} />
        <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Live Preview
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Swaps</p>
          <p className="text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
            {swaps} × {amountStx.toFixed(2)} {inputLabel}
          </p>
        </div>
        <div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Ends ~</p>
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {endDate ? endDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Est. output</p>
          <p className="text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
            {estimatedOutput != null ? `~${estimatedOutput.toFixed(outputLabel === "sBTC" ? 8 : 2)} ${outputLabel}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Total fee</p>
          <p className="text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
            {fee.toFixed(2)} {inputLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds (component is unused but must compile).

- [ ] **Step 3: Commit**

```bash
git add src/components/dca/LivePreviewCard.tsx
git commit -m "feat(dca): add LivePreviewCard component for create-form preview"
```

---

## Task 5: MiniSparkline component (placeholder-safe)

**Files:**
- Create: `src/components/dca/MiniSparkline.tsx`

**Context:** Overview tab of the expanded plan card shows a 7d sBTC price sparkline. For v1 we render a placeholder (flat dashed line + label) when no data is passed, and a real polyline when `points` are provided. Hand-rolled SVG to avoid a chart lib.

- [ ] **Step 1: Write the component**

```tsx
"use client";

interface MiniSparklineProps {
  points?: number[];          // y-values (any unit); x is index
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
}

export default function MiniSparkline({
  points,
  width = 160,
  height = 40,
  className,
  ariaLabel = "price sparkline",
}: MiniSparklineProps) {
  const padding = 2;

  if (!points || points.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={className}
        role="img"
        aria-label="price chart coming soon"
      >
        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="var(--text-muted)"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.5}
        />
        <text
          x={width / 2}
          y={height / 2 - 4}
          textAnchor="middle"
          fontSize="9"
          fill="var(--text-muted)"
        >
          chart coming soon
        </text>
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (points.length - 1);

  const d = points
    .map((y, i) => {
      const px = padding + i * stepX;
      const py = padding + ((max - y) / range) * (height - padding * 2);
      return `${i === 0 ? "M" : "L"} ${px.toFixed(2)} ${py.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dca/MiniSparkline.tsx
git commit -m "feat(dca): add MiniSparkline SVG component with placeholder fallback"
```

---

## Task 6: DCAHeroStats component

**Files:**
- Create: `src/components/dca/DCAHeroStats.tsx`

**Context:** Renders the 4 hero metrics: `[TVL] [Total Swaps] | [Active Plans] [Next Swap]`. Self-fetches protocol stats (reuse `getDCAStats`). User stats are passed in as props because `MyPlans` already owns that data and we'll wire it from the parent.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { getDCAStats, microToSTX, type DCAStats } from "@/lib/dca";
import AnimatedCounter from "@/components/motion/AnimatedCounter";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";

interface DCAHeroStatsProps {
  isConnected: boolean;
  userActivePlans: number;           // count; 0 if none
  userNextSwapLabel: string | null;  // e.g. "~2h", "Ready", or null when no active plans
  mode: "in" | "out";                // for gradient text color of the values
}

export default function DCAHeroStats({
  isConnected,
  userActivePlans,
  userNextSwapLabel,
  mode,
}: DCAHeroStatsProps) {
  const [stats, setStats] = useState<DCAStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDCAStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const tvlStx = microToSTX(stats?.totalVolume ?? 0);
  const gradClass = mode === "in" ? "gradient-text-dca-in" : "gradient-text-dca-out";

  return (
    <div className="flex flex-col gap-4">
      {/* Protocol row */}
      <div className="grid grid-cols-2 gap-4">
        <StatBlock
          label="Total Volume"
          value={
            loading ? "—" : (
              <AnimatedCounter
                value={tvlStx}
                formatFn={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                className={`text-2xl sm:text-3xl font-bold font-data ${gradClass}`}
              />
            )
          }
          suffix="STX"
        />
        <StatBlock
          label="Swaps Executed"
          value={
            loading ? "—" : (
              <AnimatedCounter
                value={stats?.totalExecuted ?? 0}
                formatFn={(v) => Math.round(v).toString()}
                className={`text-2xl sm:text-3xl font-bold font-data ${gradClass}`}
              />
            )
          }
        />
      </div>

      {/* User row */}
      <div className="border-t pt-4" style={{ borderColor: "var(--border-subtle)" }}>
        {isConnected ? (
          <div className="grid grid-cols-2 gap-4">
            <StatBlock
              label="Your Active Plans"
              value={
                <AnimatedCounter
                  value={userActivePlans}
                  formatFn={(v) => Math.round(v).toString()}
                  className={`text-xl sm:text-2xl font-bold font-data ${gradClass}`}
                />
              }
            />
            <StatBlock
              label="Next Swap"
              value={
                <span className={`text-xl sm:text-2xl font-bold font-data ${gradClass}`}>
                  {userNextSwapLabel ?? "—"}
                </span>
              }
            />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Connect your wallet to see your active plans and next swap.
            </p>
            <ConnectWalletCTA />
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  suffix,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        {value}
        {suffix && <span className="text-sm" style={{ color: "var(--text-muted)" }}>{suffix}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dca/DCAHeroStats.tsx
git commit -m "feat(dca): add DCAHeroStats component with protocol and user metrics"
```

---

## Task 7: DCAHeroSection component

**Files:**
- Create: `src/components/dca/DCAHeroSection.tsx`

**Context:** Top-level hero card: integrated tabs (DCA In / Out) on left, `DCAHeroStats` on right, gradient bg that shifts based on active tab. Controlled component — parent owns `tab` state.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import DCAHeroStats from "./DCAHeroStats";

export type DCATab = "in" | "out";

interface DCAHeroSectionProps {
  tab: DCATab;
  onTabChange: (tab: DCATab) => void;
  isConnected: boolean;
  userActivePlans: number;
  userNextSwapLabel: string | null;
}

const TABS: Array<{ key: DCATab; label: string; icon: typeof ArrowDownToLine }> = [
  { key: "in",  label: "DCA In",  icon: ArrowDownToLine },
  { key: "out", label: "DCA Out", icon: ArrowUpFromLine },
];

export default function DCAHeroSection({
  tab,
  onTabChange,
  isConnected,
  userActivePlans,
  userNextSwapLabel,
}: DCAHeroSectionProps) {
  const bgClass = tab === "in" ? "hero-bg-dca-in" : "hero-bg-dca-out";

  return (
    <section
      className={`glass-card rounded-3xl p-5 sm:p-6 ${bgClass}`}
      style={{
        transition: "background-image 300ms ease",
        boxShadow: "var(--shadow-card)",
      }}
      data-dca-hero
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-5 lg:gap-8">
        {/* Left: tabs + title */}
        <div className="flex flex-col gap-3 lg:w-1/2">
          <div
            className="inline-flex gap-1 p-1 rounded-2xl self-start"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
            role="tablist"
            aria-label="DCA mode"
          >
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange(key)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={
                    active
                      ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "var(--shadow-card)" }
                      : { color: "var(--text-muted)", opacity: 0.8 }
                  }
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              DCA Vault
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {tab === "in"
                ? "Automatically buy sBTC on a schedule with STX · Powered by Bitflow"
                : "Automatically sell sBTC for USDCx on a schedule · Powered by Bitflow"}
            </p>
          </div>
        </div>

        {/* Right: stats */}
        <div className="lg:w-1/2">
          <DCAHeroStats
            mode={tab}
            isConnected={isConnected}
            userActivePlans={userActivePlans}
            userNextSwapLabel={userNextSwapLabel}
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dca/DCAHeroSection.tsx
git commit -m "feat(dca): add DCAHeroSection with integrated tabs and gradient bg"
```

---

## Task 8: Refactor CreatePlanForm — preset chips, CSS vars, live preview

**Files:**
- Modify: `src/components/dca/CreatePlanForm.tsx` (full rewrite — current file has hardcoded colors throughout)

**Context:** Replace `#408A71` / `#B0E4CC` hardcoded colors with CSS vars. Add amount preset chips (`10 / 50 / 100 STX`), deposit % chips (`25% / 50% / Max`), wire `LivePreviewCard`, and swap the CTA for a `gradient-dca-in` button.

- [ ] **Step 1: Replace the full content of `src/components/dca/CreatePlanForm.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { PlusCircle, ArrowRight } from "lucide-react";
import { createPlan, INTERVALS, stxToMicro, microToSTX, TARGET_TOKENS, getSTXBalance } from "@/lib/dca";
import { quoteSbtcForUstx, netUstxAfterFee } from "@/lib/dca-quote";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import LivePreviewCard from "./LivePreviewCard";

const SBTC = TARGET_TOKENS[0].value;
const AMOUNT_PRESETS = [10, 50, 100];
const DEPOSIT_PERCENTS: Array<{ label: string; pct: number }> = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.50 },
  { label: "Max", pct: 1.00 },
];

interface Props {
  onCreated: () => void;
}

export default function CreatePlanForm({ onCreated }: Props) {
  const { stxAddress } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [amountPerSwap, setAmountPerSwap] = useState("");
  const [interval, setInterval] = useState<keyof typeof INTERVALS>("Weekly");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [stxBalance, setStxBalance] = useState<number | null>(null);
  const [estSbtc, setEstSbtc] = useState<number | null>(null);

  useEffect(() => {
    if (!stxAddress) return;
    getSTXBalance(stxAddress).then((bal) => setStxBalance(microToSTX(bal)));
  }, [stxAddress]);

  const amt = parseFloat(amountPerSwap) || 0;
  const dep = parseFloat(initialDeposit) || 0;
  const maxDeposit = stxBalance != null ? Math.max(0, Math.floor((stxBalance - 0.01) * 100) / 100) : 0;
  const insufficientBalance = stxBalance != null && dep > stxBalance;

  // Re-quote sBTC estimate whenever amount changes (debounced lightly by React batching)
  useEffect(() => {
    if (amt < 1) { setEstSbtc(null); return; }
    const net = netUstxAfterFee(stxToMicro(amt));
    let cancelled = false;
    quoteSbtcForUstx(net)
      .then((v) => { if (!cancelled) setEstSbtc(v); })
      .catch(() => { if (!cancelled) setEstSbtc(null); });
    return () => { cancelled = true; };
  }, [amt]);

  const validate = (): string | null => {
    if (amt < 1) return "Minimum 1 STX per swap";
    if (dep < 2) return "Minimum deposit 2 STX";
    if (dep < amt) return "Initial deposit must be ≥ amount per swap";
    if (insufficientBalance) return `Insufficient STX. Current balance: ${stxBalance?.toFixed(2)} STX`;
    return null;
  };
  const invalid = validate();

  const handleSubmit = () => {
    const err = validate();
    if (err) { addNotification(err, "error", "dca", 5000); return; }
    setLoading(true);
    createPlan(
      SBTC,
      stxToMicro(amt),
      INTERVALS[interval],
      stxToMicro(dep),
      ({ txId }) => {
        setTxId(txId);
        setLoading(false);
        addNotification(
          `Plan created! Tx: ${txId.slice(0, 10)}...`,
          "success", "dca", 5000,
          { txId, action: "created", amount: String(amt), tokenSymbol: "sBTC" },
        );
        onCreated();
      },
      () => {
        setLoading(false);
        addNotification("Failed to create plan", "error", "dca", 5000);
      },
    );
  };

  if (txId) {
    return (
      <div className="glass-card rounded-2xl p-5 flex flex-col gap-3" style={{ boxShadow: "var(--shadow-card)" }}>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "var(--accent-dim)" }}
        >
          <PlusCircle size={18} style={{ color: "var(--accent)" }} />
        </div>
        <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Plan submitted!</p>
        <p className="text-xs break-all" style={{ color: "var(--text-muted)" }}>Tx: {txId}</p>
        <p
          className="text-xs rounded-lg px-3 py-2"
          style={{ background: "var(--bg-elevated)", color: "var(--warning)" }}
        >
          Plan will appear after the transaction is confirmed (~1-2 min). Click refresh to update.
        </p>
        <button
          onClick={() => { setTxId(null); setAmountPerSwap(""); setInitialDeposit(""); }}
          className="mt-1 text-sm gradient-text-dca-in font-medium text-left hover:underline"
        >
          + Create new plan
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Create DCA Plan</h2>

      {/* Source (STX) */}
      <TokenRow symbol="STX" colorHex="#F7931A" description="Native Stacks token" label="Spend" />
      {/* Target (sBTC) */}
      <TokenRow symbol="sBTC" colorHex="#F7931A" description="Bitcoin on Stacks" label="Buy" glyph="₿" />

      {/* Amount per swap */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Amount per Swap</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={amountPerSwap}
              onChange={(e) => setAmountPerSwap(e.target.value)}
              placeholder="1"
              min="1"
              className="w-full px-3 py-2.5 pr-14 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{
                border: "1px solid var(--border-default)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>STX</span>
          </div>
          <div className="flex gap-1">
            {AMOUNT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmountPerSwap(String(p))}
                className="px-2 py-1 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interval chips */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Frequency</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(INTERVALS) as (keyof typeof INTERVALS)[]).map((key) => {
            const active = interval === key;
            return (
              <button
                key={key}
                onClick={() => setInterval(key)}
                className="py-2 rounded-xl text-sm font-medium transition-all"
                style={
                  active
                    ? { background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)" }
                    : { border: "1px solid var(--border-default)", color: "var(--text-secondary)", background: "var(--bg-card)" }
                }
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>

      {/* Initial deposit */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Initial Deposit</label>
          {stxBalance != null && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Balance:{" "}
              <span style={{ color: insufficientBalance ? "var(--negative)" : "var(--text-secondary)", fontWeight: 500 }}>
                {stxBalance.toFixed(2)} STX
              </span>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(e.target.value)}
              placeholder="2"
              min="2"
              className="w-full px-3 py-2.5 pr-14 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{
                border: `1px solid ${insufficientBalance ? "var(--negative)" : "var(--border-default)"}`,
                background: insufficientBalance ? "var(--bg-elevated)" : "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>STX</span>
          </div>
          <div className="flex gap-1">
            {DEPOSIT_PERCENTS.map(({ label, pct }) => (
              <button
                key={label}
                type="button"
                disabled={stxBalance == null}
                onClick={() => setInitialDeposit((maxDeposit * pct).toFixed(2))}
                className="px-2 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                style={{
                  background: "var(--accent-dim)",
                  color: "var(--accent)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live preview */}
      <LivePreviewCard
        mode="in"
        amountStx={amt}
        depositStx={dep}
        intervalKey={interval}
        estimatedOutput={estSbtc != null && amt > 0 ? estSbtc : null}
        outputLabel="sBTC"
        inputLabel="STX"
        invalidReason={amt > 0 && dep > 0 ? invalid : null}
      />

      <button
        onClick={handleSubmit}
        disabled={loading || !!invalid}
        className="gradient-dca-in w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:brightness-110"
      >
        {loading ? "Waiting for wallet…" : <>Create Plan <ArrowRight size={14} /></>}
      </button>
      <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
        Mainnet · 0.3% protocol fee per swap
      </p>
    </div>
  );
}

function TokenRow({
  symbol,
  colorHex,
  description,
  label,
  glyph,
}: {
  symbol: string;
  colorHex: string;
  description: string;
  label: string;
  glyph?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label} (Source Token)</label>
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ background: colorHex }}
        >
          {glyph ?? symbol[0]}
        </span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{symbol}</span>
        <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{description}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Manual browser check**

Run `npm run dev` and visit `http://localhost:3000/dca`. Verify:
- Form renders with new look (vars not hex)
- Amount presets fill the input when clicked
- Deposit % chips compute against balance
- Live preview card appears once `amount ≥ 1` and `deposit ≥ amount`
- CTA has green→cyan gradient
- Toggling to dark mode (if toggle exists) keeps colors readable

- [ ] **Step 4: Commit**

```bash
git add src/components/dca/CreatePlanForm.tsx
git commit -m "refactor(dca): redesign CreatePlanForm with presets, vars, and live preview"
```

---

## Task 9: Mirror refactor — CreateOutPlanForm

**Files:**
- Modify: `src/components/dca-out/CreateOutPlanForm.tsx`

**Context:** Apply the same restyle + presets + LivePreviewCard (mode="out") to the DCA-Out create form. Quote helper differs (3-hop route), so we keep the form's existing quoting logic but still surface `estimatedOutput` into LivePreviewCard.

- [ ] **Step 1: Read the existing file first**

Run: `Read` tool on `src/components/dca-out/CreateOutPlanForm.tsx` (full file). This plan does not include its current code; skim it once before editing so the diff is targeted.

- [ ] **Step 2: Apply the same restyle pattern**

Following the same structural changes from Task 8, in `CreateOutPlanForm.tsx`:
1. Replace any hardcoded color hexes with the matching CSS var (e.g. `#408A71` → `var(--accent)`, `#B0E4CC` → `var(--accent-dim)`).
2. Replace the amount preset values with sBTC-appropriate defaults:
   ```ts
   const AMOUNT_PRESETS = [0.001, 0.005, 0.01]; // sBTC per swap
   ```
3. Replace deposit preset pattern with the same `DEPOSIT_PERCENTS` array from Task 8 (copy the constant into this file — do NOT create a shared helper unless the duplication bothers you during this task; YAGNI).
4. Import `LivePreviewCard` and render it above the submit button with `mode="out"`, `outputLabel="USDCx"`, `inputLabel="sBTC"`, and the existing 3-hop quote value fed into `estimatedOutput`.
5. Change the submit button classes to `gradient-dca-out` and drop any `bg-[#...]` references.
6. Keep all quoting, validation, and tx callback logic exactly as-is — only visuals and preview wiring change.

- [ ] **Step 3: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 4: Manual browser check**

`npm run dev`, click the DCA Out tab, confirm form renders with orange→pink gradient CTA, preview card appears with USDCx output, presets work.

- [ ] **Step 5: Commit**

```bash
git add src/components/dca-out/CreateOutPlanForm.tsx
git commit -m "refactor(dca-out): restyle CreateOutPlanForm with presets and live preview"
```

---

## Task 10: Extract PlanCardRow (collapsed view)

**Files:**
- Create: `src/components/dca/PlanCardRow.tsx`

**Context:** The compact row users see when a plan is collapsed. Shows token pair, status dot, progress bar, remaining swaps, next-swap label, and an inline Execute shortcut when ready. Stateless — parent controls expand/click.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import { type DCAPlan, microToSTX, blocksToInterval, TARGET_TOKENS } from "@/lib/dca";
import { formatBlocksCountdown } from "@/lib/dca-preview";

interface PlanCardRowProps {
  plan: DCAPlan;
  currentBlock: number;
  expanded: boolean;
  onToggle: () => void;
  onExecuteShortcut?: () => void; // optional — opens expanded + focuses execute tab
  mode?: "in" | "out";
}

function shortToken(contractId: string): string {
  const known = TARGET_TOKENS.find((t) => t.value === contractId);
  if (known) return known.label;
  const name = contractId.split(".")[1] ?? contractId;
  return name.length > 20 ? name.slice(0, 18) + "…" : name;
}

export default function PlanCardRow({
  plan,
  currentBlock,
  expanded,
  onToggle,
  onExecuteShortcut,
  mode = "in",
}: PlanCardRowProps) {
  const balSTX = microToSTX(plan.bal);
  const amtSTX = microToSTX(plan.amt);
  const remainingSwaps = plan.amt > 0 ? Math.floor(plan.bal / plan.amt) : 0;
  const totalSwaps = Math.floor((plan.tss + plan.bal) / Math.max(plan.amt, 1));
  const progressPct = totalSwaps > 0 ? Math.round((plan.tsd / totalSwaps) * 100) : 0;
  const nextBlock = plan.leb === 0 ? currentBlock : plan.leb + plan.ivl;
  const blocksLeft = Math.max(0, nextBlock - currentBlock);
  const canExecuteNow = plan.active && plan.bal >= plan.amt && blocksLeft === 0;

  const statusDotColor = !plan.active
    ? plan.bal > 0 ? "var(--warning)" : "var(--text-muted)"
    : "var(--positive)";
  const statusLabel = !plan.active
    ? plan.bal > 0 ? "Paused" : "Depleted"
    : "Active";

  const progressClass = mode === "in" ? "gradient-dca-in" : "gradient-dca-out";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left p-4 flex flex-col gap-2 hover:brightness-105 transition-all"
      aria-expanded={expanded}
    >
      {/* Line 1: token pair + id + amount + chevron */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>STX</span>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {shortToken(plan.token)}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          · {blocksToInterval(plan.ivl)} · #{plan.id}
        </span>
        <span className="ml-auto text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
          {amtSTX.toFixed(2)} STX
        </span>
        {expanded ? (
          <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
        ) : (
          <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
        )}
      </div>

      {/* Line 2: status + progress bar + counts */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusDotColor }} />
          {statusLabel}
        </span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
          <div className={`${progressClass} h-full`} style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-[11px] font-data" style={{ color: "var(--text-muted)" }}>
          {plan.tsd}/{totalSwaps} · {balSTX.toFixed(1)} STX left
        </span>
      </div>

      {/* Line 3: next-swap + optional execute shortcut */}
      <div className="flex items-center gap-2">
        <span className="text-[11px]" style={{ color: canExecuteNow ? "var(--positive)" : "var(--text-muted)" }}>
          {canExecuteNow
            ? "⏱ Ready now"
            : plan.leb === 0 ? "⏱ Pending first swap" : `⏱ Next ${formatBlocksCountdown(blocksLeft)}`}
        </span>
        {canExecuteNow && onExecuteShortcut && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onExecuteShortcut(); }}
            className={`${mode === "in" ? "gradient-dca-in" : "gradient-dca-out"} ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white`}
          >
            <Zap size={10} /> Execute
          </button>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dca/PlanCardRow.tsx
git commit -m "feat(dca): add PlanCardRow compact-collapsed component"
```

---

## Task 11: Create OverviewTab component

**Files:**
- Create: `src/components/dca/PlanCardTabs/OverviewTab.tsx`

**Context:** Default tab when a plan is expanded. Shows stats grid, mini sparkline (placeholder), and action buttons (Deposit more, Pause/Resume, Cancel). Receives all data and callbacks as props — stateless.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { Pause, Play, Trash2, PlusCircle, Loader2 } from "lucide-react";
import { type DCAPlan, microToSTX, stxToMicro, depositToPlan, pausePlan, resumePlan, cancelPlan } from "@/lib/dca";
import { useNotificationStore } from "@/store/notificationStore";
import MiniSparkline from "../MiniSparkline";

interface OverviewTabProps {
  plan: DCAPlan;
  onRefresh: () => void;
  onRequestCancel: () => void; // parent opens cancel modal
}

export default function OverviewTab({ plan, onRefresh, onRequestCancel }: OverviewTabProps) {
  const { addNotification } = useNotificationStore();
  const [depositInput, setDepositInput] = useState("");
  const [loading, setLoading] = useState(false);

  const avgOutput = plan.tsd > 0 ? plan.tss / plan.tsd : 0; // avg uSTX per swap (rough)

  const run = (fn: () => void) => { setLoading(true); fn(); };

  const handleDeposit = () => {
    const n = parseFloat(depositInput);
    if (!n || n < 1) return;
    run(() =>
      depositToPlan(plan.id, stxToMicro(n),
        ({ txId }) => {
          setLoading(false); setDepositInput("");
          addNotification(`Deposited ${n} STX (tx ${txId.slice(0,10)}…)`, "success", "dca", 5000);
          onRefresh();
        },
        () => { setLoading(false); addNotification("Deposit failed", "error", "dca", 5000); },
      ),
    );
  };

  const handlePause = () =>
    run(() => pausePlan(plan.id,
      () => { setLoading(false); onRefresh(); },
      () => { setLoading(false); addNotification("Pause failed", "error", "dca", 5000); },
    ));

  const handleResume = () =>
    run(() => resumePlan(plan.id,
      () => { setLoading(false); onRefresh(); },
      () => { setLoading(false); addNotification("Resume failed", "error", "dca", 5000); },
    ));

  return (
    <div className="flex flex-col gap-3">
      {/* Stats + sparkline row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="grid grid-cols-2 gap-2">
          <StatMini label="Swaps done" value={plan.tsd.toString()} />
          <StatMini label="STX spent" value={microToSTX(plan.tss).toFixed(1)} />
          <StatMini label="Avg / swap" value={`${microToSTX(avgOutput).toFixed(2)} STX`} />
          <StatMini label="Block created" value={plan.cat.toString()} />
        </div>
        <div
          className="rounded-xl p-3 flex flex-col gap-2"
          style={{ background: "var(--bg-elevated)" }}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            sBTC price (7d)
          </p>
          <MiniSparkline />
        </div>
      </div>

      {/* Deposit row */}
      {plan.active && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={depositInput}
              onChange={(e) => setDepositInput(e.target.value)}
              placeholder="Add STX"
              className="w-full px-3 py-2 pr-12 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{
                border: "1px solid var(--border-default)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>STX</span>
          </div>
          <button
            onClick={handleDeposit}
            disabled={loading || !depositInput}
            className="px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
            Add
          </button>
        </div>
      )}

      {/* Action row */}
      <div className="flex gap-2">
        {plan.active ? (
          <button
            onClick={handlePause}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ border: "1px solid var(--warning)", color: "var(--warning)", background: "var(--bg-card)" }}
          >
            <Pause size={14} /> Pause
          </button>
        ) : plan.bal >= plan.amt ? (
          <button
            onClick={handleResume}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ border: "1px solid var(--accent)", color: "var(--accent)", background: "var(--bg-card)" }}
          >
            <Play size={14} /> Resume
          </button>
        ) : null}
        {(plan.active || plan.bal > 0) && (
          <button
            onClick={onRequestCancel}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ border: "1px solid var(--negative)", color: "var(--negative)", background: "var(--bg-card)" }}
          >
            <Trash2 size={14} /> Cancel & Refund
          </button>
        )}
      </div>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-2" style={{ background: "var(--bg-elevated)" }}>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-xs font-semibold font-data" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dca/PlanCardTabs/OverviewTab.tsx
git commit -m "feat(dca): add OverviewTab for expanded plan card"
```

---

## Task 12: Create ExecuteTab component (extract from existing PlanCard)

**Files:**
- Create: `src/components/dca/PlanCardTabs/ExecuteTab.tsx`

**Context:** Move the execute block (quote + slippage chips + router input + execute button) out of `PlanCard.tsx`. Use the shared `quoteSbtcForUstx` helper from Task 2. This is nearly a lift-and-shift with CSS-var cleanup.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { type DCAPlan, microToSTX, executePlan, DEFAULT_SWAP_ROUTER } from "@/lib/dca";
import { quoteSbtcForUstx, netUstxAfterFee } from "@/lib/dca-quote";
import { useNotificationStore } from "@/store/notificationStore";

interface ExecuteTabProps {
  plan: DCAPlan;
  currentBlock: number;
  onRefresh: () => void;
}

export default function ExecuteTab({ plan, currentBlock, onRefresh }: ExecuteTabProps) {
  const { addNotification } = useNotificationStore();
  const [routerInput, setRouterInput] = useState(DEFAULT_SWAP_ROUTER);
  const [slippage, setSlippage] = useState(1);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quotedSbtc, setQuotedSbtc] = useState<number | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextBlock = plan.leb === 0 ? currentBlock : plan.leb + plan.ivl;
  const blocksLeft = Math.max(0, nextBlock - currentBlock);
  const canExecuteNow = plan.active && plan.bal >= plan.amt && blocksLeft === 0;
  const netUstx = netUstxAfterFee(plan.amt);
  const minAmountOut = quotedSbtc != null ? Math.floor(quotedSbtc * (1 - slippage / 100) * 1e8) : 0;

  useEffect(() => {
    if (!canExecuteNow) return;
    setQuoteLoading(true); setQuoteError(null); setQuotedSbtc(null);
    quoteSbtcForUstx(netUstx)
      .then(setQuotedSbtc)
      .catch((e: Error) => setQuoteError(e.message ?? "Failed to get quote"))
      .finally(() => setQuoteLoading(false));
  }, [canExecuteNow, netUstx]);

  const handleExecute = () => {
    if (!routerInput.includes(".")) return;
    setLoading(true);
    executePlan(plan.id, routerInput.trim(), minAmountOut,
      ({ txId }) => {
        setLoading(false);
        addNotification("Plan executed! Swap completed", "success", "dca", 5000,
          { planId: String(plan.id), txId, action: "executed" });
        onRefresh();
      },
      () => {
        setLoading(false);
        addNotification("Execution failed", "error", "dca", 5000, { planId: String(plan.id) });
      },
    );
  };

  if (!canExecuteNow) {
    return (
      <div className="rounded-xl p-4 text-center" style={{ background: "var(--bg-elevated)" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Not ready to execute. {plan.leb === 0 ? "Pending first swap." : `Next in ~${blocksLeft} blocks.`}
        </p>
      </div>
    );
  }

  return (
    <div className="gradient-border-dca-in rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Zap size={13} style={{ color: "var(--accent)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Ready to Execute</span>
        <span className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>0.3% protocol fee</span>
      </div>

      {/* Quote */}
      <div className="rounded-lg p-2.5 flex flex-col gap-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
            Swap {microToSTX(netUstx).toFixed(4)} STX
          </span>
          <div className="flex gap-1">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors"
                style={
                  slippage === s
                    ? { background: "var(--accent)", color: "#fff" }
                    : { background: "var(--accent-dim)", color: "var(--accent)" }
                }
              >
                {s}%
              </button>
            ))}
            <span className="text-[10px] self-center ml-0.5" style={{ color: "var(--text-muted)" }}>slip</span>
          </div>
        </div>
        {quoteLoading ? (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={11} className="animate-spin" /> Fetching quote…
          </span>
        ) : quoteError ? (
          <span className="text-xs" style={{ color: "var(--negative)" }}>{quoteError}</span>
        ) : quotedSbtc != null ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
              ≥ {(quotedSbtc * (1 - slippage / 100)).toFixed(8)}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>sBTC</span>
            <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
              min {minAmountOut} sats
            </span>
          </div>
        ) : null}
      </div>

      {/* Router */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>Swap Router</label>
        <input
          type="text"
          value={routerInput}
          onChange={(e) => setRouterInput(e.target.value)}
          placeholder="SP….swap-router-contract"
          className="w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:ring-2"
          style={{
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <button
        onClick={handleExecute}
        disabled={loading || quoteLoading || !!quoteError || !routerInput.includes(".")}
        className="gradient-dca-in px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 self-start"
      >
        <Zap size={13} /> {loading ? "Executing…" : "Execute"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dca/PlanCardTabs/ExecuteTab.tsx
git commit -m "feat(dca): add ExecuteTab for expanded plan card"
```

---

## Task 13: Create HistoryTab component (placeholder)

**Files:**
- Create: `src/components/dca/PlanCardTabs/HistoryTab.tsx`

**Context:** v1 placeholder. Renders empty-state icon + "History coming soon". Phase 2 will wire contract events.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { History } from "lucide-react";

export default function HistoryTab() {
  return (
    <div className="rounded-xl p-6 flex flex-col items-center gap-2 text-center" style={{ background: "var(--bg-elevated)" }}>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: "var(--accent-dim)" }}
      >
        <History size={18} style={{ color: "var(--accent)" }} />
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        History coming soon
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        We&apos;ll show each past swap here once the indexer is wired up.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dca/PlanCardTabs/HistoryTab.tsx
git commit -m "feat(dca): add HistoryTab placeholder for expanded plan card"
```

---

## Task 14: PlanCardExpanded assembler + rewrite PlanCard

**Files:**
- Create: `src/components/dca/PlanCardExpanded.tsx`
- Modify: `src/components/dca/PlanCard.tsx` (full rewrite — compose Row + Expanded + cancel modal)

**Context:** Tabbed container that switches between Overview / Execute / History. `PlanCard.tsx` becomes a thin wrapper that owns expanded state, cancel-modal state, and passes a `defaultTab` when the user clicks the row's Execute shortcut.

- [ ] **Step 1: Create `PlanCardExpanded.tsx`**

```tsx
"use client";

import { useState } from "react";
import { BarChart3, Zap, History } from "lucide-react";
import { type DCAPlan } from "@/lib/dca";
import OverviewTab from "./PlanCardTabs/OverviewTab";
import ExecuteTab from "./PlanCardTabs/ExecuteTab";
import HistoryTab from "./PlanCardTabs/HistoryTab";

type InnerTab = "overview" | "execute" | "history";

interface PlanCardExpandedProps {
  plan: DCAPlan;
  currentBlock: number;
  onRefresh: () => void;
  onRequestCancel: () => void;
  defaultTab?: InnerTab;
}

const TABS: Array<{ key: InnerTab; label: string; icon: typeof BarChart3 }> = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "execute",  label: "Execute",  icon: Zap },
  { key: "history",  label: "History",  icon: History },
];

export default function PlanCardExpanded({
  plan,
  currentBlock,
  onRefresh,
  onRequestCancel,
  defaultTab = "overview",
}: PlanCardExpandedProps) {
  const [active, setActive] = useState<InnerTab>(defaultTab);

  return (
    <div className="border-t p-4 flex flex-col gap-3" style={{ borderColor: "var(--border-subtle)" }}>
      <div
        className="inline-flex gap-1 p-1 rounded-xl self-start"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
        role="tablist"
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(key)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={
                isActive
                  ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "var(--shadow-card)" }
                  : { color: "var(--text-muted)" }
              }
            >
              <Icon size={12} /> {label}
            </button>
          );
        })}
      </div>

      {active === "overview" && (
        <OverviewTab plan={plan} onRefresh={onRefresh} onRequestCancel={onRequestCancel} />
      )}
      {active === "execute" && (
        <ExecuteTab plan={plan} currentBlock={currentBlock} onRefresh={onRefresh} />
      )}
      {active === "history" && <HistoryTab />}
    </div>
  );
}
```

- [ ] **Step 2: Replace the full content of `src/components/dca/PlanCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { type DCAPlan, microToSTX, cancelPlan } from "@/lib/dca";
import { useNotificationStore } from "@/store/notificationStore";
import PlanCardRow from "./PlanCardRow";
import PlanCardExpanded from "./PlanCardExpanded";

interface Props {
  plan: DCAPlan;
  currentBlock: number;
  onRefresh: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function PlanCard({ plan, currentBlock, onRefresh, isExpanded, onToggle }: Props) {
  const { addNotification } = useNotificationStore();
  const [defaultTab, setDefaultTab] = useState<"overview" | "execute" | "history">("overview");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const balSTX = microToSTX(plan.bal);

  const handleExecuteShortcut = () => {
    setDefaultTab("execute");
    if (!isExpanded) onToggle();
  };

  const confirmCancel = () => {
    setCancelOpen(false);
    setCancelLoading(true);
    cancelPlan(plan.id,
      ({ txId }) => {
        setCancelLoading(false);
        addNotification("Plan cancelled & refunded", "success", "dca", 5000,
          { planId: String(plan.id), action: "cancelled", amount: balSTX.toFixed(2), txId });
        onRefresh();
      },
      () => {
        setCancelLoading(false);
        addNotification("Failed to cancel plan", "error", "dca", 5000);
      },
    );
  };

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden transition-all hover:brightness-[1.02]"
      style={{ boxShadow: "var(--shadow-card)" }}
      data-plan-id={plan.id}
    >
      <PlanCardRow
        plan={plan}
        currentBlock={currentBlock}
        expanded={isExpanded}
        onToggle={onToggle}
        onExecuteShortcut={handleExecuteShortcut}
        mode="in"
      />
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <PlanCardExpanded
              plan={plan}
              currentBlock={currentBlock}
              onRefresh={onRefresh}
              onRequestCancel={() => setCancelOpen(true)}
              defaultTab={defaultTab}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel modal */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="rounded-2xl w-[90%] max-w-sm p-6 flex flex-col gap-4"
            style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card-hover)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "var(--bg-elevated)" }}
              >
                <Trash2 size={18} style={{ color: "var(--negative)" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Cancel & Refund</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Plan #{plan.id}</p>
              </div>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Are you sure? You will be refunded{" "}
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{balSTX.toFixed(2)} STX</span>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCancelOpen(false)}
                disabled={cancelLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
                style={{ border: "1px solid var(--border-default)", color: "var(--text-secondary)", background: "var(--bg-card)" }}
              >
                Keep Plan
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "var(--negative)" }}
              >
                Cancel & Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/dca/PlanCardExpanded.tsx src/components/dca/PlanCard.tsx
git commit -m "refactor(dca): split PlanCard into row + tabbed expanded view"
```

---

## Task 15: MyPlans — one-at-a-time expand + empty state with presets

**Files:**
- Modify: `src/components/dca/MyPlans.tsx` (full rewrite — current file maps plans straight to `<PlanCard>`; needs to own `expandedId` and the empty-state w/ presets)

**Context:** Parent owns which plan is expanded (so opening one collapses the others). Empty state includes clickable preset chips that dispatch a custom event `dca:fill-form` — `CreatePlanForm` (Task 16) will listen.

- [ ] **Step 1: Read the current `MyPlans.tsx`**

Run: `Read` on `src/components/dca/MyPlans.tsx`. Skim so you know existing fetch/render logic before replacing.

- [ ] **Step 2: Rewrite `MyPlans.tsx`**

Replace the full file content with the version below. **Important:** the `getUserPlans` / `getNextExecutionBlock` / any loading-state logic in the existing file should be preserved — the snippet below assumes you retain that fetch pattern and only add:
1. `expandedId` state + pass `isExpanded` / `onToggle` to each `PlanCard`.
2. `currentBlock` fetch (already done in existing code — keep it).
3. Empty-state block when plans array is empty.

```tsx
"use client";

import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { getUserPlans, type DCAPlan } from "@/lib/dca";
import PlanCard from "./PlanCard";

interface Props {
  address: string;
}

const PRESETS = [
  { label: "10 STX weekly",    amount: "10",  interval: "Weekly",   deposit: "50"  },
  { label: "50 STX biweekly",  amount: "50",  interval: "Biweekly", deposit: "200" },
];

function fireFillForm(p: typeof PRESETS[number]) {
  window.dispatchEvent(new CustomEvent("dca:fill-form", { detail: p }));
}

export default function MyPlans({ address }: Props) {
  const [plans, setPlans] = useState<DCAPlan[] | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const refresh = () => {
    getUserPlans(address).then(setPlans).catch(() => setPlans([]));
  };

  useEffect(() => {
    refresh();
    fetch("https://api.hiro.so/v2/info")
      .then((r) => r.json())
      .then((d) => setCurrentBlock(d?.stacks_tip_height ?? 0))
      .catch(() => {});
  }, [address]);

  if (plans === null) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-card rounded-2xl h-20 animate-shimmer" style={{ boxShadow: "var(--shadow-card)" }} />
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div
        className="glass-card rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--accent-dim)" }}
        >
          <Inbox size={22} style={{ color: "var(--accent)" }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>No plans yet</p>
        <p className="text-xs max-w-xs" style={{ color: "var(--text-muted)" }}>
          Create your first DCA plan on the left to start auto-buying sBTC.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => fireFillForm(p)}
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--border-subtle)" }}
            >
              Try: {p.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          currentBlock={currentBlock}
          onRefresh={refresh}
          isExpanded={expandedId === plan.id}
          onToggle={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
        />
      ))}
    </div>
  );
}
```

**If the existing `MyPlans.tsx` has additional logic (sorting, filtering, error states)** not captured above, merge those back in. The new controls (`expandedId`, preset empty state) are purely additive.

- [ ] **Step 3: Wire preset listener into `CreatePlanForm.tsx`**

Open `src/components/dca/CreatePlanForm.tsx` (from Task 8). Add a `useEffect` right after the existing `useEffect` that fetches balance:

```ts
useEffect(() => {
  const handler = (e: Event) => {
    const { amount, interval, deposit } = (e as CustomEvent).detail;
    setAmountPerSwap(amount);
    setInterval(interval as keyof typeof INTERVALS);
    setInitialDeposit(deposit);
  };
  window.addEventListener("dca:fill-form", handler);
  return () => window.removeEventListener("dca:fill-form", handler);
}, []);
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/dca/MyPlans.tsx src/components/dca/CreatePlanForm.tsx
git commit -m "refactor(dca): add one-at-a-time expand + preset empty state"
```

---

## Task 16: Mirror to dca-out (MyOutPlans + OutPlanCard)

**Files:**
- Modify: `src/components/dca-out/OutPlanCard.tsx`
- Modify: `src/components/dca-out/MyOutPlans.tsx`

**Context:** Apply the same split as Tasks 10–15 to the dca-out mirror. Because the Out flow has a different quote route (3-hop), do NOT reuse `ExecuteTab.tsx` directly — keep the Out execute flow inside `OutPlanCard` for now, but still adopt Row + Expanded + tabbed structure so the visuals match.

- [ ] **Step 1: Read both existing files**

Run: `Read` on both `src/components/dca-out/OutPlanCard.tsx` and `src/components/dca-out/MyOutPlans.tsx`. This plan treats the mirror as a structured port — the concrete lines to change are analogous to Tasks 10–15 but with `mode="out"` everywhere, orange→pink gradient classes, and USDCx labels.

- [ ] **Step 2: Port `OutPlanCard.tsx`**

Follow Tasks 10 + 14 patterns:
1. Extract a local `OutPlanCardRow` (inline in this file is fine — DRY pressure is low for one extra file), passing `mode="out"` to its progress/gradient classes.
2. Extract a local tabbed expanded area with Overview / Execute / History:
   - Overview tab: reuse `OverviewTab` pattern but adapt deposit to sBTC and update stat labels (sBTC spent, avg output).
   - Execute tab: keep the 3-hop quote fetch inline (do not refactor into a shared helper in this task).
   - History tab: reuse the shared `HistoryTab` component.
3. Use `gradient-border-dca-out` and `gradient-dca-out` utility classes.
4. Preserve existing cancel-modal pattern.
5. Accept `isExpanded` / `onToggle` props so the parent can own state (same interface as `PlanCard`).

- [ ] **Step 3: Port `MyOutPlans.tsx`**

Mirror Task 15. `expandedId` state, preset chips in empty state (sBTC-appropriate values like `0.001 sBTC daily` / `0.005 sBTC weekly`), shimmer skeletons, `refresh` pattern.

For preset events, use a distinct event name `"dca-out:fill-form"` and wire a listener in `CreateOutPlanForm.tsx` (from Task 9).

- [ ] **Step 4: Verify typecheck + build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/dca-out/OutPlanCard.tsx src/components/dca-out/MyOutPlans.tsx src/components/dca-out/CreateOutPlanForm.tsx
git commit -m "refactor(dca-out): mirror plan-card split and empty-state presets"
```

---

## Task 17: InfoFooter component

**Files:**
- Create: `src/components/dca/InfoFooter.tsx`

**Context:** Extract the 3-card footer from `DCAPageContent.tsx`. Adds lucide-react icons in gradient-dim squares. Accepts `tab` prop to swap content between In/Out modes.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { TrendingUp, TrendingDown, Coins, ShieldCheck, type LucideIcon } from "lucide-react";

interface InfoFooterProps {
  tab: "in" | "out";
}

interface FooterCard {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const CONTENT: Record<"in" | "out", FooterCard[]> = {
  in: [
    { icon: TrendingUp,  title: "Dollar-Cost Averaging", desc: "Spread your risk by buying tokens on a fixed schedule, regardless of price fluctuations." },
    { icon: Coins,       title: "0.3% Protocol Fee",     desc: "0.3% of each swap goes to the treasury. The remaining 99.7% is used to purchase sBTC via Bitflow." },
    { icon: ShieldCheck, title: "Non-custodial",          desc: "STX is held directly in the smart contract. Purchased tokens are sent straight to your wallet." },
  ],
  out: [
    { icon: TrendingDown, title: "Dollar-Cost Averaging Out", desc: "Gradually sell sBTC for USDCx on a fixed schedule to lock in value over time." },
    { icon: Coins,        title: "0.3% Protocol Fee",         desc: "0.3% of each swap goes to the treasury. The remaining 99.7% is swapped via the 3-hop Bitflow route." },
    { icon: ShieldCheck,  title: "3-Hop Swap",                desc: "sBTC → STX → aeUSDC → USDCx. All swaps are routed through Bitflow pools automatically." },
  ],
};

export default function InfoFooter({ tab }: InfoFooterProps) {
  const cards = CONTENT[tab];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
      {cards.map(({ icon: Icon, title, desc }) => (
        <div
          key={title}
          className="glass-card rounded-2xl p-4 transition-all hover:-translate-y-0.5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: "var(--accent-dim)" }}
          >
            <Icon size={18} style={{ color: "var(--accent)" }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{title}</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dca/InfoFooter.tsx
git commit -m "feat(dca): add InfoFooter component with gradient icon cards"
```

---

## Task 18: Refactor DCAPageContent to use new components

**Files:**
- Modify: `src/components/dca/DCAPageContent.tsx` (full rewrite)

**Context:** The page orchestrator now wires up `DCAHeroSection`, the two create forms, the two plans lists, and `InfoFooter`. The old `DCAStats`, inline tabs, and inline info footer are removed. Hero user-metrics are computed here (passed down from the user's plans).

- [ ] **Step 1: Rewrite `DCAPageContent.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useWalletStore } from "@/store/walletStore";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import EmptyState from "@/components/motion/EmptyState";
import ConnectWalletCTA from "@/components/wallet/ConnectWalletCTA";
import { Wallet } from "lucide-react";
import { getUserPlans, type DCAPlan } from "@/lib/dca";
import { nextSwapCountdown } from "@/lib/dca-preview";

import DCAHeroSection, { type DCATab } from "./DCAHeroSection";
import CreatePlanForm from "./CreatePlanForm";
import MyPlans from "./MyPlans";
import InfoFooter from "./InfoFooter";
import CreateOutPlanForm from "@/components/dca-out/CreateOutPlanForm";
import MyOutPlans from "@/components/dca-out/MyOutPlans";

export default function DCAPageContent() {
  const { isConnected, stxAddress } = useWalletStore();
  const [tab, setTab] = useState<DCATab>("in");
  const [refreshKey, setRefreshKey] = useState(0);
  const [outRefreshKey, setOutRefreshKey] = useState(0);

  // Hero stats derive from user's own plans — fetch once here and pass down
  const [userPlans, setUserPlans] = useState<DCAPlan[]>([]);
  const [currentBlock, setCurrentBlock] = useState(0);

  useEffect(() => {
    if (!stxAddress) { setUserPlans([]); return; }
    getUserPlans(stxAddress).then(setUserPlans).catch(() => setUserPlans([]));
    fetch("https://api.hiro.so/v2/info")
      .then((r) => r.json())
      .then((d) => setCurrentBlock(d?.stacks_tip_height ?? 0))
      .catch(() => {});
  }, [stxAddress, refreshKey, outRefreshKey]);

  const activePlans = userPlans.filter((p) => p.active).length;
  const nextSwapLabel = nextSwapCountdown(userPlans, currentBlock);

  const handleRefresh    = useCallback(() => setRefreshKey((k) => k + 1), []);
  const handleOutRefresh = useCallback(() => setOutRefreshKey((k) => k + 1), []);

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="DCA Vault" />
      <AnimatedPage className="max-w-6xl mx-auto w-full px-4 py-6">
        <StaggerChildren className="flex flex-col gap-6">
          {/* Hero (tabs + stats) */}
          <MotionCard disableHover>
            <DCAHeroSection
              tab={tab}
              onTabChange={setTab}
              isConnected={isConnected}
              userActivePlans={activePlans}
              userNextSwapLabel={nextSwapLabel}
            />
          </MotionCard>

          {/* Main dashboard */}
          <MotionCard disableHover>
            {!isConnected ? (
              <div className="glass-card rounded-2xl" style={{ boxShadow: "var(--shadow-card)" }}>
                <EmptyState
                  icon={<Wallet size={28} style={{ color: "var(--accent)" }} />}
                  title="Connect your wallet to get started"
                  description="Connect a Leather or Xverse wallet to create and manage your DCA plans."
                  action={<ConnectWalletCTA />}
                />
              </div>
            ) : tab === "in" ? (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
                <div className="lg:sticky lg:top-6">
                  <CreatePlanForm onCreated={handleRefresh} />
                </div>
                <div>
                  <MyPlans key={refreshKey} address={stxAddress!} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
                <div className="lg:sticky lg:top-6">
                  <CreateOutPlanForm onCreated={handleOutRefresh} />
                </div>
                <div>
                  <MyOutPlans key={outRefreshKey} address={stxAddress!} />
                </div>
              </div>
            )}
          </MotionCard>

          {/* Info footer */}
          <MotionCard disableHover>
            <InfoFooter tab={tab} />
          </MotionCard>
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
```

- [ ] **Step 2: Delete obsolete files**

```bash
rm src/components/dca/DCAStats.tsx
rm src/components/dca-out/DCAOutStats.tsx
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds. Any broken imports to `DCAStats` or `DCAOutStats` indicate a missed consumer — fix them.

- [ ] **Step 4: Manual browser verification**

Run `npm run dev`. Visit `http://localhost:3000/dca`:
- Hero renders with integrated tabs, gradient bg
- Tab switch transitions background gradient
- When connected: form + plans list side-by-side; user stats appear in hero
- When disconnected: empty state visible, hero shows Connect CTA in the user-stats row
- Info footer shows 3 cards with icons
- No console errors

Then open DevTools → toggle mobile viewport and verify mobile stacking works.

- [ ] **Step 5: Commit**

```bash
git add src/components/dca/DCAPageContent.tsx
git add -u src/components/dca/DCAStats.tsx src/components/dca-out/DCAOutStats.tsx
git commit -m "refactor(dca): rewrite DCAPageContent to use new hero + footer components"
```

---

## Task 19: Update existing Playwright e2e tests

**Files:**
- Modify: `e2e/dca.spec.ts`

**Context:** Several existing tests hard-code the old background color `rgb(64, 138, 113)` and the old description text. Replace them with assertions that match the new design.

- [ ] **Step 1: Read the current test file**

Run: `Read` on `e2e/dca.spec.ts` (full file).

- [ ] **Step 2: Update broken assertions**

In `e2e/dca.spec.ts`, make these changes:

Replace:
```ts
test("DCA In tab is active by default", async ({ page }) => {
  const dcaInButton = page.getByRole("button", { name: /DCA In/i });
  await expect(dcaInButton).toHaveCSS("background-color", "rgb(64, 138, 113)");
});
```

With:
```ts
test("DCA In tab is active by default", async ({ page }) => {
  const dcaInButton = page.getByRole("tab", { name: /DCA In/i });
  await expect(dcaInButton).toHaveAttribute("aria-selected", "true");
});
```

Replace the `"renders DCA In/Out tab navigator"` test to use `role: "tab"` instead of `"button"`:
```ts
test("renders DCA In/Out tab navigator", async ({ page }) => {
  await expect(page.getByRole("tab", { name: /DCA In/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /DCA Out/i })).toBeVisible();
});
```

Replace the `"switching to DCA Out tab updates content"` test:
```ts
test("switching to DCA Out tab updates content", async ({ page }) => {
  await page.getByRole("tab", { name: /DCA Out/i }).click();
  await expect(
    page.getByText(/Automatically sell sBTC for USDCx/)
  ).toBeVisible();
});
```

Replace the `"renders DCA stats section"` test (the old `DCAStats` component is gone; new hero stats show different labels):
```ts
test("renders hero stats section", async ({ page }) => {
  await expect(page.locator("[data-dca-hero]")).toBeVisible();
  await expect(page.getByText(/Total Volume|Swaps Executed/i).first()).toBeVisible();
});
```

Leave `"renders info footer cards"`, `"DCA Out tab shows different info footer"`, and the Guest-mode tests as-is — the text content still matches.

- [ ] **Step 3: Run the updated tests**

Run: `npm run test:e2e -- e2e/dca.spec.ts 2>&1 | tail -40`
Expected: All tests pass.

If any fail, read the failure, fix the test (not the implementation — the design spec is our source of truth), rerun.

- [ ] **Step 4: Commit**

```bash
git add e2e/dca.spec.ts
git commit -m "test(dca): update e2e assertions for redesigned tabs and hero"
```

---

## Task 20: Add e2e coverage for new behaviors

**Files:**
- Modify: `e2e/dca.spec.ts` (append new tests)

**Context:** New features worth covering: tab switch changes hero bg, plan-card expand toggles and is one-at-a-time, empty-state preset chips fill the form. We mock `getUserPlans` via existing `mockAPIs` — extend if needed.

- [ ] **Step 1: Inspect `mockAPIs` to confirm plan endpoints**

Run: `Read` on `e2e/fixtures/test-utils.ts` to see all current mocks. If `getUserPlans` / contract reads are not mocked, add a mock for `api.hiro.so/v2/contracts/call-read/**` that returns 2 plans — use a simple fixture shape matching `DCAPlan` (id, token, amt, ivl, bal, active, tsd, tss, leb, cat).

- [ ] **Step 2: Append new tests to `e2e/dca.spec.ts`**

At the bottom of the `test.describe("DCA Page (Connected)", ...)` block (after the last existing test but before the closing `});`), add:

```ts
test("tab switch updates aria-selected on tabs", async ({ page }) => {
  await page.getByRole("tab", { name: /DCA Out/i }).click();
  await expect(page.getByRole("tab", { name: /DCA Out/i })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /DCA In/i })).toHaveAttribute("aria-selected", "false");
});

test("hero description reflects active tab", async ({ page }) => {
  await expect(page.getByText(/Automatically buy sBTC on a schedule/)).toBeVisible();
  await page.getByRole("tab", { name: /DCA Out/i }).click();
  await expect(page.getByText(/Automatically sell sBTC for USDCx/)).toBeVisible();
});

test("empty plans state shows preset chips when no plans", async ({ page }) => {
  // This test relies on getUserPlans returning [] — confirm your mock default
  await expect(page.getByText("No plans yet")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: /Try: 10 STX weekly/i })).toBeVisible();
});
```

Note: the `"empty plans state"` test only passes if `mockAPIs` makes `getUserPlans` return `[]`. If the current mock does not, add a route override inside the test:

```ts
await page.route("**/v2/contracts/call-read/**", (route) => {
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ okay: true, result: "0x0a" /* none */ }) });
});
```

Adjust the mock payload to whatever the DCA contract's `get-user-plan-ids` expects to decode as "no plans".

- [ ] **Step 3: Run the new tests**

Run: `npm run test:e2e -- e2e/dca.spec.ts 2>&1 | tail -40`
Expected: All tests pass. If mocking is flaky, iterate until stable.

- [ ] **Step 4: Commit**

```bash
git add e2e/dca.spec.ts e2e/fixtures/test-utils.ts
git commit -m "test(dca): add e2e coverage for tab switching and empty state"
```

---

## Task 21: Final verification + polish pass

**Files:**
- (No new files — verification + any cleanup spotted during browser walkthrough)

**Context:** Final check before calling the redesign done. Run full test suite, walk through every state in the browser, capture any residual hardcoded colors or inconsistencies.

- [ ] **Step 1: Run all e2e tests**

Run: `npm run test:e2e 2>&1 | tail -30`
Expected: All DCA tests pass. Other tests (dashboard, navigation, landing, notifications) should be unaffected — if any break, determine whether it's a redesign side-effect or pre-existing.

- [ ] **Step 2: Run build + lint**

Run: `npm run lint && npm run build 2>&1 | tail -30`
Expected: No lint errors, build succeeds, no type errors.

- [ ] **Step 3: Hardcode-color audit**

Run: `Grep` for `#408A71|#B0E4CC|#285A48|rgb\(64, 138, 113\)` in `src/components/dca*/` and `src/components/dca-out*/`. Expected: zero matches. If any remain, replace with `var(--accent)` / `var(--accent-dim)` / etc.

- [ ] **Step 4: Browser walkthrough**

Run `npm run dev`. For each of the following states, visually verify and screenshot (optional):

**Desktop (1440px):**
- [ ] Guest: hero with Connect CTA in user-stats row, info footer visible
- [ ] Connected, DCA In tab: hero with green→cyan gradient, form on left, plans on right
- [ ] Connected, DCA Out tab: gradient bg crossfades to orange→pink
- [ ] Form: type `50` in amount — preview card renders with swaps count + est sBTC
- [ ] Form: click `Max` deposit chip — fills input
- [ ] Plan card collapsed: shows 3-line compact row
- [ ] Plan card expanded: inner tabs render (Overview / Execute / History)
- [ ] Expand another plan — previous one collapses (one-at-a-time)
- [ ] Click Cancel — modal appears with backdrop blur; click Keep Plan closes modal

**Mobile (375px):**
- [ ] Hero stacks vertically, tabs + description + 2x2 metrics
- [ ] Form full-width, presets wrap
- [ ] Plans list full-width, collapsed rows readable

**Dark mode** (if the theme toggle exists):
- [ ] All text remains legible
- [ ] Gradients feel right (not washed out)

- [ ] **Step 5: Fix any issues found**

For each problem found, make the minimum fix, commit with a targeted message (e.g. `fix(dca): correct mobile preview chip wrapping`). No batch-fix commit.

- [ ] **Step 6: Final review commit (if no issues)**

If the walkthrough was clean and Step 5 produced no fixes, you're done. Otherwise, the fix commits from Step 5 are the terminal commits.

---

## Self-Review Notes

**Spec coverage check:**
- Decisions 1–9 in the spec each map to a task (tokens → Task 1; hero layout → Tasks 6–7; dual gradient → Task 1 + use sites; plan-card hybrid → Tasks 10–14; form preview → Tasks 3–4, 8–9; mobile-first → verified in Task 21; info footer → Task 17; tab switcher integrated → Task 7).
- Architecture file tree matches tasks (`DCAHeroSection`, `DCAHeroStats`, `LivePreviewCard`, `PlanCardRow`, `PlanCardExpanded`, three tab files, `MiniSparkline`, `InfoFooter`).
- Motion catalog: existing primitives reused (`AnimatedPage`, `StaggerChildren`, `AnimatedCounter`, `MotionCard`); new motion only where needed (hero bg transition in Task 7, plan-card expand in Task 14).

**Placeholder scan:** No "TBD", "TODO", or "implement later" left. Step instructions contain complete code or explicit operations.

**Type consistency:**
- `DCATab` type declared in Task 7, re-exported and consumed in Task 18.
- `quoteSbtcForUstx` / `netUstxAfterFee` declared in Task 2, used in Tasks 8 and 12.
- `PlanCard` props (`isExpanded`, `onToggle`) declared in Task 14, consumed in Task 15.
- `LivePreviewCard` prop names consistent between Tasks 4, 8, and 9.

**Known trade-offs noted in the spec and honored here:**
- History tab is a placeholder (Task 13).
- Mini sparkline uses a placeholder SVG when no data is passed (Task 5).
- Accessibility is best-effort (role="tab", aria-selected, aria-expanded) but not audited beyond these basics.
- No unit-test framework is introduced — e2e via Playwright covers behavior.
