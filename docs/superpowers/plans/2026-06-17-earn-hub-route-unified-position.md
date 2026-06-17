# Earn Hub v2 — `/earn` Route + Unified Stacking Position — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/earn` route that hosts the stacking/yield surface, and make `StackingTracker` recognise both liquid (stSTX) and native PoX positions so liquid stakers no longer see "Not Stacking".

**Architecture:** Frontend-only slice. A pure `summarizeStackingPosition` helper combines already-fetched liquid + PoX values; `StackingTracker` and a new `EarnSummaryCard` both consume it so the numbers can't drift. Stacking/yield components move from `src/components/assets/` to `src/components/earn/` and mount on a new `/earn` page; `/assets` keeps a compact summary card linking across. Real instant-unstake is explicitly deferred (no stSTX swap route exists yet).

**Tech Stack:** Next.js 15 App Router, next-intl (en/vi/zh/ja), Zustand, SWR, Vitest (unit), Playwright (e2e), Tailwind + CSS-var design tokens.

## Global Constraints

- Commit directly on `main`, no feature branches. No `Co-Authored-By` trailer. Each commit must be green.
- i18n is key-for-key identical across all four locales (`messages/{en,vi,zh,ja}.json`); the parity test `src/i18n/messages.test.ts` enforces this — every new key MUST exist in all four files.
- `@stacks/*` browser-only modules must not SSR — page content components are loaded via `next/dynamic` with `{ ssr: false }` (mirror `AssetsPageWrapper`).
- Design uses CSS variables (`var(--accent)`, `var(--text-primary)`, `var(--bg-card)`, `var(--border-subtle)`, `var(--text-muted)`); shadcn utility classes like `text-muted-foreground`/`bg-card` are no-ops — do not use them.
- Routing is next-intl `as-needed`; a new `src/app/[locale]/earn/` directory is picked up automatically — no `pathnames` config to edit. Always navigate with `Link`/`usePathname` from `@/i18n/navigation`, never `next/link`.
- Pure domain logic in `src/lib/domain/stacking/` must stay fetch-free (no network, no `@stacks/connect`).
- Verification commands: `npm run lint`, `npm run build`, `npm test` (unit/vitest), `npm run test:e2e`.

---

### Task 1: `summarizeStackingPosition` pure helper

**Files:**
- Create: `src/lib/domain/stacking/position.ts`
- Test: `src/lib/domain/stacking/position.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `interface StackingPositionInput { stStxBalance: number; microStxPerStStx: number | null; poxLockedStx: number; poxIsStacking: boolean }`
  - `interface StackingSummary { liquidStx: number | null; poxStx: number; totalStx: number; isEarning: boolean }`
  - `function summarizeStackingPosition(input: StackingPositionInput): StackingSummary`
  - Semantics: `liquidStx` = `0` when no stSTX; `null` when stSTX > 0 but rate is null (value unknown, still earning); else `stStxBalance * microStxPerStStx / 1e6`. `poxStx` = `poxLockedStx` when `poxIsStacking` else `0`. `isEarning` = `stStxBalance > 0 || poxIsStacking`. `totalStx` = `(liquidStx ?? 0) + poxStx`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/domain/stacking/position.test.ts
import { describe, it, expect } from "vitest";
import { summarizeStackingPosition } from "./position";

describe("summarizeStackingPosition", () => {
  it("values a liquid-only position via the exchange rate", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 10,
      microStxPerStStx: 1_100_000, // 1 stSTX = 1.1 STX
      poxLockedStx: 0,
      poxIsStacking: false,
    });
    expect(s).toEqual({ liquidStx: 11, poxStx: 0, totalStx: 11, isEarning: true });
  });

  it("reports a PoX-only position as earning", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 0,
      microStxPerStStx: null,
      poxLockedStx: 500,
      poxIsStacking: true,
    });
    expect(s).toEqual({ liquidStx: 0, poxStx: 500, totalStx: 500, isEarning: true });
  });

  it("sums liquid and PoX when both are present", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 10,
      microStxPerStStx: 1_000_000,
      poxLockedStx: 200,
      poxIsStacking: true,
    });
    expect(s).toEqual({ liquidStx: 10, poxStx: 200, totalStx: 210, isEarning: true });
  });

  it("is not earning when nothing is staked", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 0,
      microStxPerStStx: null,
      poxLockedStx: 0,
      poxIsStacking: false,
    });
    expect(s).toEqual({ liquidStx: 0, poxStx: 0, totalStx: 0, isEarning: false });
  });

  it("returns null liquid value when stSTX is held but the rate is unavailable", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 10,
      microStxPerStStx: null,
      poxLockedStx: 0,
      poxIsStacking: false,
    });
    expect(s).toEqual({ liquidStx: null, poxStx: 0, totalStx: 0, isEarning: true });
  });

  it("ignores PoX locked STX when PoX is not active", () => {
    const s = summarizeStackingPosition({
      stStxBalance: 0,
      microStxPerStStx: null,
      poxLockedStx: 999,
      poxIsStacking: false,
    });
    expect(s).toEqual({ liquidStx: 0, poxStx: 0, totalStx: 0, isEarning: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/domain/stacking/position.test.ts`
Expected: FAIL — `Failed to resolve import "./position"` / `summarizeStackingPosition is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/domain/stacking/position.ts
// Pure combiner for a user's total stacking position across liquid stacking
// (stSTX via StackingDAO) and native PoX. No fetch — inputs are already-read
// values; the component wires the reads.

export interface StackingPositionInput {
  /** stSTX balance in stSTX (human) units; 0 if none held. */
  stStxBalance: number;
  /** micro-STX per 1 stSTX (from fetchStxPerStStx), or null if unavailable. */
  microStxPerStStx: number | null;
  /** Native PoX locked STX in STX (human) units; 0 if none. */
  poxLockedStx: number;
  /** Whether native PoX reports an active stacking lock. */
  poxIsStacking: boolean;
}

export interface StackingSummary {
  /** stSTX position valued in STX; 0 if no stSTX, null if held but rate unknown. */
  liquidStx: number | null;
  /** STX locked in native PoX (0 when not actively stacking). */
  poxStx: number;
  /** Combined STX known to be earning: (liquidStx ?? 0) + poxStx. */
  totalStx: number;
  /** True when either liquid stSTX is held or PoX is active. */
  isEarning: boolean;
}

export function summarizeStackingPosition(input: StackingPositionInput): StackingSummary {
  const hasLiquid = input.stStxBalance > 0;
  const liquidStx = !hasLiquid
    ? 0
    : input.microStxPerStStx === null
    ? null
    : (input.stStxBalance * input.microStxPerStStx) / 1_000_000;
  const poxStx = input.poxIsStacking ? input.poxLockedStx : 0;
  const isEarning = hasLiquid || input.poxIsStacking;
  const totalStx = (liquidStx ?? 0) + poxStx;
  return { liquidStx, poxStx, totalStx, isEarning };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/domain/stacking/position.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/stacking/position.ts src/lib/domain/stacking/position.test.ts
git commit -m "feat(stacking): add summarizeStackingPosition (liquid + PoX combiner)"
```

---

### Task 2: i18n keys for Earn (all four locales)

**Files:**
- Modify: `messages/en.json`, `messages/vi.json`, `messages/zh.json`, `messages/ja.json`
- Test: `src/i18n/messages.test.ts` (existing parity test — must stay green)

**Interfaces:**
- Consumes: nothing.
- Produces these keys, used by later tasks:
  - `nav.earn` (string)
  - `common.cmdk.earn.label`, `common.cmdk.earn.desc`
  - `earn.title` (Topbar title)
  - `assets.earnSummary.title`, `.earning` (ICU `{amount}`), `.empty`, `.cta`
  - `assets.stacking.liquidTitle`, `.liquidStaked` (ICU `{amount}`), `.liquidValue` (ICU `{stx}`), `.estApy`, `.unstakeSoon`

- [ ] **Step 1: Add `nav.earn` to all four locales**

In `messages/en.json`, inside the `"nav"` object (after `"assetsShort": "Assets",`):
```json
    "earn": "Earn",
```
`messages/vi.json` `nav`: `"earn": "Kiếm lời",`
`messages/zh.json` `nav`: `"earn": "赚取",`
`messages/ja.json` `nav`: `"earn": "運用",`

- [ ] **Step 2: Add `common.cmdk.earn` to all four locales**

In `messages/en.json`, inside `"common"."cmdk"` (after the `"ai"` entry):
```json
      "earn": {
        "label": "Earn",
        "desc": "Stacking & yield"
      }
```
`vi`: `{ "label": "Kiếm lời", "desc": "Stacking & lợi suất" }`
`zh`: `{ "label": "赚取", "desc": "Stacking 与收益" }`
`ja`: `{ "label": "運用", "desc": "ステーキングと利回り" }`

(Mind the comma after the preceding `"ai"` object.)

- [ ] **Step 3: Add a top-level `earn` namespace to all four locales**

In `messages/en.json`, add a top-level key (e.g. right after the `"assets"` object closes):
```json
  "earn": {
    "title": "Earn"
  },
```
`vi`: `"title": "Kiếm lời"` · `zh`: `"title": "赚取"` · `ja`: `"title": "運用"`

- [ ] **Step 4: Add `assets.earnSummary` to all four locales**

In `messages/en.json`, inside `"assets"`:
```json
    "earnSummary": {
      "title": "Earning",
      "earning": "~{amount} STX at work",
      "empty": "Put idle STX to work",
      "cta": "Earn"
    },
```
`vi`: `{ "title": "Đang kiếm lời", "earning": "~{amount} STX đang sinh lời", "empty": "Cho STX nhàn rỗi sinh lời", "cta": "Kiếm lời" }`
`zh`: `{ "title": "收益中", "earning": "~{amount} STX 正在生息", "empty": "让闲置 STX 产生收益", "cta": "赚取" }`
`ja`: `{ "title": "運用中", "earning": "~{amount} STX を運用中", "empty": "余剰 STX を運用に回す", "cta": "運用" }`

- [ ] **Step 5: Add liquid-stacking keys to `assets.stacking` in all four locales**

In `messages/en.json`, inside `"assets"."stacking"`:
```json
      "liquidTitle": "Liquid Stacking",
      "liquidStaked": "{amount} stSTX",
      "liquidValue": "≈ {stx} STX",
      "estApy": "Est. APY",
      "unstakeSoon": "Unstake (coming soon)",
```
`vi`: `liquidTitle "Liquid Stacking"`, `liquidStaked "{amount} stSTX"`, `liquidValue "≈ {stx} STX"`, `estApy "APY ước tính"`, `unstakeSoon "Rút (sắp có)"`
`zh`: `liquidTitle "流动质押"`, `liquidStaked "{amount} stSTX"`, `liquidValue "≈ {stx} STX"`, `estApy "预估 APY"`, `unstakeSoon "赎回（即将推出）"`
`ja`: `liquidTitle "リキッドステーキング"`, `liquidStaked "{amount} stSTX"`, `liquidValue "≈ {stx} STX"`, `estApy "予想 APY"`, `unstakeSoon "アンステーク（近日対応）"`

- [ ] **Step 6: Run the parity test**

Run: `npx vitest run src/i18n/messages.test.ts`
Expected: PASS — all locales key-for-key identical (no missing, no extra).

- [ ] **Step 7: Commit**

```bash
git add messages/en.json messages/vi.json messages/zh.json messages/ja.json
git commit -m "i18n(earn): add nav.earn, cmdk.earn, earn + assets earn/liquid keys (4 locales)"
```

---

### Task 3: `/earn` route shell

**Files:**
- Create: `src/app/[locale]/earn/page.tsx`
- Create: `src/components/earn/EarnPageWrapper.tsx`
- Create: `src/components/earn/EarnPageContent.tsx`

**Interfaces:**
- Consumes: `earn.title` (Task 2), `Topbar`, `AnimatedPage`.
- Produces: a reachable `/earn` route rendering an empty hub shell. Later tasks mount components into `EarnPageContent`.

- [ ] **Step 1: Create the route page**

```tsx
// src/app/[locale]/earn/page.tsx
import type { Metadata } from "next";
import EarnPageWrapper from "@/components/earn/EarnPageWrapper";

export const metadata: Metadata = {
  title: "Earn — Stacking & Yield",
  description:
    "Put your STX to work. Liquid stacking, yield opportunities, and your earning positions on Stacks mainnet.",
  alternates: { canonical: "/earn" },
};

export default function EarnPage() {
  return <EarnPageWrapper />;
}
```

- [ ] **Step 2: Create the SSR-skipping wrapper**

```tsx
// src/components/earn/EarnPageWrapper.tsx
"use client";

import dynamic from "next/dynamic";

// Skip SSR to avoid Turbopack issues with @stacks/* browser-only modules.
const EarnPageContent = dynamic(
  () => import("@/components/earn/EarnPageContent"),
  { ssr: false }
);

export default function EarnPageWrapper() {
  return <EarnPageContent />;
}
```

- [ ] **Step 3: Create the page content shell**

```tsx
// src/components/earn/EarnPageContent.tsx
"use client";

import { useTranslations } from "next-intl";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";

export default function EarnPageContent() {
  const t = useTranslations("earn");
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title={t("title")} />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <StaggerChildren className="space-y-4 md:space-y-5">
          {/* Components mounted in Task 5 */}
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
```

- [ ] **Step 4: Verify the route builds and renders**

Run: `npm run build`
Expected: build succeeds and the output route list includes `/[locale]/earn`.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/earn/page.tsx src/components/earn/EarnPageWrapper.tsx src/components/earn/EarnPageContent.tsx
git commit -m "feat(earn): add /earn route shell (page, wrapper, content)"
```

---

### Task 4: Wire `/earn` into navigation

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:25-32` (navItems array)
- Modify: `src/components/layout/BottomNav.tsx:24-29` (moreNavItems array)
- Modify: `src/components/layout/CommandPalette.tsx:74-82` (commands array)

**Interfaces:**
- Consumes: `nav.earn`, `common.cmdk.earn.*` (Task 2). Uses the `Sprout` icon from `lucide-react`.
- Produces: `/earn` reachable from sidebar, mobile "More" menu, and command palette.

- [ ] **Step 1: Add the Earn item to the sidebar**

In `src/components/layout/Sidebar.tsx`, add `Sprout` to the existing `lucide-react` import, then add to `navItems` after the `/dca` entry:
```ts
  { href: "/earn",          key: "earn",          icon: Sprout },
```

- [ ] **Step 2: Add the Earn item to the mobile bottom-nav "More" menu**

In `src/components/layout/BottomNav.tsx`, add `Sprout` to the `lucide-react` import, then add to `moreNavItems` (first entry):
```ts
  { href: "/earn",          key: "earn",      icon: Sprout },
```

- [ ] **Step 3: Add the Earn command to the command palette**

In `src/components/layout/CommandPalette.tsx`, add `Sprout` to the `lucide-react` import, then add to the `commands` array after the `dca` entry:
```tsx
    { id: "earn",          label: t("earn.label"),          description: t("earn.desc"),          icon: <Sprout size={18} />,       action: () => navigate("/earn", "earn"),                keywords: ["earn", "stack", "stacking", "yield", "ststx", "apy"] },
```

- [ ] **Step 4: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: no errors; `/earn` present in all three nav surfaces.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/BottomNav.tsx src/components/layout/CommandPalette.tsx
git commit -m "feat(earn): surface /earn in sidebar, bottom-nav, command palette"
```

---

### Task 5: Move stacking/yield components to `src/components/earn/` and mount them

**Files:**
- Move: `src/components/assets/StackingTracker.tsx` → `src/components/earn/StackingTracker.tsx`
- Move: `src/components/assets/YieldOpportunities.tsx` → `src/components/earn/YieldOpportunities.tsx`
- Move: `src/components/assets/StakeStxModal.tsx` → `src/components/earn/StakeStxModal.tsx`
- Move: `src/components/assets/IdleStxNudge.tsx` → `src/components/earn/IdleStxNudge.tsx`
- Modify: `src/components/earn/EarnPageContent.tsx`

**Interfaces:**
- Consumes: the four moved components.
- Produces: `/earn` renders `StackingTracker`, `IdleStxNudge`, `YieldOpportunities`. `StackingTracker` still PoX-only here (unification is Task 6).
- Note: `YieldOpportunities` imports `./StakeStxModal` (relative) — moving both together keeps that import valid. No other module imports `StakeStxModal` or `IdleStxNudge`.

- [ ] **Step 1: Move the four files with git**

```bash
git mv src/components/assets/StackingTracker.tsx src/components/earn/StackingTracker.tsx
git mv src/components/assets/YieldOpportunities.tsx src/components/earn/YieldOpportunities.tsx
git mv src/components/assets/StakeStxModal.tsx src/components/earn/StakeStxModal.tsx
git mv src/components/assets/IdleStxNudge.tsx src/components/earn/IdleStxNudge.tsx
```

- [ ] **Step 2: Confirm no stale import paths remain**

Run: `grep -rn "assets/StackingTracker\|assets/YieldOpportunities\|assets/StakeStxModal\|assets/IdleStxNudge" src/`
Expected: only references inside `src/components/assets/AssetsPageContent.tsx` (handled in Task 7). The moved files use relative imports (`./StakeStxModal`) which stay valid; if grep shows any other absolute reference, update it to `@/components/earn/...`.

- [ ] **Step 3: Mount the components in `EarnPageContent`**

Replace the body of `src/components/earn/EarnPageContent.tsx` with:
```tsx
// src/components/earn/EarnPageContent.tsx
"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import YieldOpportunities from "@/components/earn/YieldOpportunities";
import IdleStxNudge from "@/components/earn/IdleStxNudge";

// @stacks/* browser-only modules — skip SSR.
const StackingTracker = dynamic(
  () => import("@/components/earn/StackingTracker"),
  { ssr: false }
);

export default function EarnPageContent() {
  const t = useTranslations("earn");
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title={t("title")} />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <StaggerChildren className="space-y-4 md:space-y-5">
          <MotionCard disableHover>
            <StackingTracker />
          </MotionCard>
          <IdleStxNudge />
          <MotionCard>
            <YieldOpportunities />
          </MotionCard>
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
```

- [ ] **Step 4: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: builds clean. (`AssetsPageContent.tsx` still imports the old paths — it will fail to build ONLY if the imports point at moved files. Because Task 7 removes them and we have not yet, verify: if the build breaks on `AssetsPageContent`, proceed to Task 7 before considering this task done — but prefer to keep each commit green by NOT committing a broken build. If the build breaks here, complete Task 7's removal edits, then commit Tasks 5 and 7 together. Otherwise commit now.)

> Practical note: moving the files makes `AssetsPageContent`'s imports dangling, so the build WILL break until Task 7. Therefore: do Task 5 Steps 1–3, then immediately do Task 7's edits, run the build once, and make a single commit covering both. The split is kept for review clarity; the commit is shared.

- [ ] **Step 5: Commit** — see Task 7 Step 4 (shared commit).

---

### Task 6: Unify `StackingTracker` (liquid stSTX + native PoX)

**Files:**
- Modify: `src/components/earn/StackingTracker.tsx`

**Interfaces:**
- Consumes: `summarizeStackingPosition` (Task 1); `useTokensWithValues` (`@/hooks/useMarketData`) for stSTX balance; `fetchStxPerStStx` (`@/lib/stacking-dao`); `useStackingStatusSnap` (`@/hooks/usePortfolioSnapshot`); i18n keys `assets.stacking.liquidTitle/liquidStaked/liquidValue/estApy/unstakeSoon`.
- Produces: a tracker that shows an "Active" badge and a liquid-stacking section when stSTX is held, the existing PoX section when natively stacking, and "Not Stacking" only when neither is present.

- [ ] **Step 1: Add the liquid reads at the top of the default export**

In `src/components/earn/StackingTracker.tsx`, add imports:
```tsx
import { useEffect, useMemo, useState } from "react";
import { useTokensWithValues } from "@/hooks/useMarketData";
import { fetchStxPerStStx } from "@/lib/stacking-dao";
import { summarizeStackingPosition } from "@/lib/domain/stacking/position";
```
Inside `export default function StackingTracker()`, after the existing `const { data, isLoading } = useStackingStatusSnap(addr);` line, add:
```tsx
  const { data: tokenData } = useTokensWithValues(addr);
  const stStxBalance = useMemo(
    () => (tokenData?.tokens ?? []).find((tk) => tk.symbol === "stSTX")?.balance ?? 0,
    [tokenData]
  );

  const [microStxPerStStx, setMicroStxPerStStx] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    if (stStxBalance > 0) {
      fetchStxPerStStx().then((r) => { if (active) setMicroStxPerStStx(r); });
    }
    return () => { active = false; };
  }, [stStxBalance]);

  const summary = useMemo(
    () => summarizeStackingPosition({
      stStxBalance,
      microStxPerStStx,
      poxLockedStx: status?.lockedSTX ?? 0,
      poxIsStacking: status?.isStacking ?? false,
    }),
    [stStxBalance, microStxPerStStx, status]
  );
```
(`status` is the existing `const status: StackingStatus | null = data ?? null;`.)

- [ ] **Step 2: Add a `LiquidStacking` section component**

Add this component above the default export (it reuses the existing `formatSTXAmount` helper in the file):
```tsx
function LiquidStacking({
  stStx,
  valueStx,
}: {
  stStx: number;
  valueStx: number | null;
}) {
  const t = useTranslations("assets.stacking");
  return (
    <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#B0E4CC]/20 flex items-center justify-center">
          <Lock size={14} className="text-[#285A48]" />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">{t("liquidTitle")}</p>
          <p className="text-sm font-bold text-gray-900">
            {t("liquidStaked", { amount: formatSTXAmount(stStx) })}
          </p>
          {valueStx !== null && (
            <p className="text-[11px] text-gray-400">
              {t("liquidValue", { stx: formatSTXAmount(valueStx) })}
            </p>
          )}
        </div>
      </div>
      <span className="text-[11px] font-semibold text-gray-300 cursor-not-allowed" aria-disabled="true">
        {t("unstakeSoon")}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Render the liquid section and fix the "Active / Not Stacking" logic**

In the default export's JSX, the status badge currently keys off `status.isStacking`. Change the badge condition and the body so they key off `summary.isEarning`:

- Badge (header): replace `status.isStacking` with `summary.isEarning`, and `t("active") : t("notStacking")` stays.
- Body block: replace the final ternary
  ```tsx
  ) : status?.isStacking ? (
    <ActiveStacking s={status} />
  ) : status ? (
    <NotStacking s={status} />
  ) : null}
  ```
  with:
  ```tsx
  ) : summary.isEarning ? (
    <div className="space-y-5">
      {stStxBalance > 0 && (
        <LiquidStacking stStx={stStxBalance} valueStx={summary.liquidStx} />
      )}
      {status?.isStacking && <ActiveStacking s={status} />}
    </div>
  ) : status ? (
    <NotStacking s={status} />
  ) : null}
  ```
  The header `{!loading && status && (...)}` guards should also allow rendering when `summary.isEarning` even if `status` is loading; keep `status` guards as-is for the cycle chip, but change the dot/badge to use `summary.isEarning`. (Liquid-only users may have `status` present-but-not-stacking; the badge now correctly reads "Active".)

- [ ] **Step 4: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 5: Manual smoke (mock wallet) — optional but recommended**

Run dev server, connect the mock wallet on `/earn`. With a mock stSTX balance, the tracker shows the Liquid Stacking row + "Active" badge instead of "Not Stacking". Kill the dev server (free port 3000) when done.

- [ ] **Step 6: Commit**

```bash
git add src/components/earn/StackingTracker.tsx
git commit -m "feat(earn): unify StackingTracker across liquid stSTX and native PoX"
```

---

### Task 7: Trim `/assets` and add `EarnSummaryCard`

**Files:**
- Create: `src/components/assets/EarnSummaryCard.tsx`
- Modify: `src/components/assets/AssetsPageContent.tsx`

**Interfaces:**
- Consumes: `summarizeStackingPosition` (Task 1); `useTokensWithValues`; `fetchStxPerStStx`; `useStackingStatusSnap`; i18n `assets.earnSummary.*`.
- Produces: `/assets` overview shows a compact `EarnSummaryCard` (links to `/earn`) instead of `YieldOpportunities`/`IdleStxNudge`; positions tab keeps `SBTCMonitor` only.

- [ ] **Step 1: Create `EarnSummaryCard`**

```tsx
// src/components/assets/EarnSummaryCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Sprout, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useWalletStore } from "@/store/walletStore";
import { useTokensWithValues } from "@/hooks/useMarketData";
import { useStackingStatusSnap } from "@/hooks/usePortfolioSnapshot";
import { fetchStxPerStStx } from "@/lib/stacking-dao";
import { summarizeStackingPosition } from "@/lib/domain/stacking/position";

export default function EarnSummaryCard() {
  const t = useTranslations("assets.earnSummary");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: tokenData } = useTokensWithValues(addr);
  const { data: status } = useStackingStatusSnap(addr);

  const stStxBalance = useMemo(
    () => (tokenData?.tokens ?? []).find((tk) => tk.symbol === "stSTX")?.balance ?? 0,
    [tokenData]
  );
  const [microStxPerStStx, setMicroStxPerStStx] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    if (stStxBalance > 0) fetchStxPerStStx().then((r) => { if (active) setMicroStxPerStStx(r); });
    return () => { active = false; };
  }, [stStxBalance]);

  const summary = summarizeStackingPosition({
    stStxBalance,
    microStxPerStStx,
    poxLockedStx: status?.lockedSTX ?? 0,
    poxIsStacking: status?.isStacking ?? false,
  });

  return (
    <Link
      href="/earn"
      className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
             style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}>
          <Sprout size={18} />
        </div>
        <div>
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
            {t("title")}
          </p>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {summary.isEarning ? t("earning", { amount: summary.totalStx.toFixed(2) }) : t("empty")}
          </p>
        </div>
      </div>
      <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: "var(--accent)" }}>
        {t("cta")} <ArrowUpRight size={12} />
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Update `AssetsPageContent` imports**

In `src/components/assets/AssetsPageContent.tsx`:
- Remove: `import YieldOpportunities from "@/components/assets/YieldOpportunities";`
- Remove: `import IdleStxNudge from "./IdleStxNudge";`
- Remove the `StackingTracker` dynamic import block (lines defining `const StackingTracker = dynamic(...)`).
- Add: `import EarnSummaryCard from "@/components/assets/EarnSummaryCard";`

- [ ] **Step 3: Update the tab bodies**

In the **overview** tab, replace:
```tsx
              <IdleStxNudge />
              <MotionCard>
                <YieldOpportunities />
              </MotionCard>
```
with:
```tsx
              <EarnSummaryCard />
```

In the **positions** tab, replace the two-column grid:
```tsx
          {tab === "positions" && (
            <MotionCard disableHover>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <StackingTracker />
                <SBTCMonitor />
              </div>
            </MotionCard>
          )}
```
with a single-card layout (StackingTracker now lives on `/earn`):
```tsx
          {tab === "positions" && (
            <MotionCard>
              <SBTCMonitor />
            </MotionCard>
          )}
```

- [ ] **Step 4: Verify build + lint, then commit (shared with Task 5)**

Run: `npm run lint && npm run build`
Expected: clean — no dangling imports to the moved files.

```bash
git add src/components/earn/ src/components/assets/AssetsPageContent.tsx src/components/assets/EarnSummaryCard.tsx
git commit -m "feat(earn): move stacking/yield to /earn; /assets shows EarnSummaryCard"
```

> This single commit covers the file moves (Task 5) and the `/assets` trim (Task 7) so the tree is green at the commit boundary.

---

### Task 8: Update the e2e suite for `/earn`

**Files:**
- Modify: `e2e/earn-stake.spec.ts`

**Interfaces:**
- Consumes: existing `mockWalletConnected`, `mockAPIs` fixtures from `e2e/fixtures/test-utils.ts`.
- Produces: the stake-flow smoke test runs against `/earn`, plus a nav-reachability smoke check.

- [ ] **Step 1: Point the existing test at `/earn` and add a nav smoke**

Replace `e2e/earn-stake.spec.ts` with:
```ts
import { test, expect } from "@playwright/test";
import { mockWalletConnected, mockAPIs } from "./fixtures/test-utils";

test.describe("Earn — liquid stacking", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnected(page);
    await mockAPIs(page);
    await page.goto("/earn");
  });

  test("stacking row opens the in-app stake modal", async ({ page }) => {
    // The yield card lists a Liquid Stacking row whose action is an in-app button.
    const stakingRow = page.locator("li").filter({ hasText: /Liquid Stacking/i }).first();
    await expect(stakingRow).toBeVisible({ timeout: 10_000 });

    await stakingRow.getByRole("button").first().click();

    // StakeStxModal title — messages → assets.stake.title
    await expect(page.getByText("Stake STX").first()).toBeVisible();
  });

  test("the earn page is reachable", async ({ page }) => {
    // Landing directly on /earn renders the hub (Topbar title from earn.title).
    await expect(page.getByText("Earn").first()).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 2: Run the e2e spec on desktop**

Run: `npx playwright test e2e/earn-stake.spec.ts --project=chromium`
Expected: PASS (both tests).

- [ ] **Step 3: Run the full e2e suite to confirm no regressions**

Run: `npm run test:e2e`
Expected: desktop ~baseline passing, mobile ~baseline passing; no failures attributable to the `/assets` trim or the new route. If any prior test asserted stacking/yield content on `/assets`, update it to `/earn`.

- [ ] **Step 4: Commit**

```bash
git add e2e/earn-stake.spec.ts
git commit -m "test(e2e): drive the stake flow on /earn and smoke the route"
```

---

### Task 9: Final verification gate

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 2: Unit tests**

Run: `npm test`
Expected: PASS — includes `position.test.ts` and `messages.test.ts`.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: success; route list includes `/[locale]/earn`.

- [ ] **Step 4: Full e2e**

Run: `npm run test:e2e`
Expected: baseline pass counts on desktop + mobile. Free port 3000 afterward if a dev server was left running.

- [ ] **Step 5: Confirm no orphaned references**

Run: `grep -rn "components/assets/StackingTracker\|components/assets/YieldOpportunities\|components/assets/StakeStxModal\|components/assets/IdleStxNudge" src/ e2e/`
Expected: no matches.

---

## Self-Review Notes

- **Spec coverage:** `/earn` route (Tasks 3–4) ✓; Approach-A move + summary card (Tasks 5, 7) ✓; unified position incl. "Not Stacking" fix (Tasks 1, 6) ✓; disabled "coming soon" unstake (Task 6) ✓; nav surfaces (Task 4) ✓; i18n 4 locales + parity (Task 2) ✓; rate-null edge handling (Task 1 + Task 6 conditional render) ✓; e2e move + nav smoke, including the `faad07e` test relocation (Task 8) ✓; SBTCMonitor stays on `/assets` (Task 7) ✓.
- **Deferred (next slice, by design):** real instant-unstake via a new `stSTX↔STX` `ROUTE_TABLE` entry (needs on-chain pool verification, `senderSpendPostCondition` branch, characterization tests).
- **Type consistency:** `StackingSummary` fields (`liquidStx`, `poxStx`, `totalStx`, `isEarning`) used identically in Tasks 1, 6, 7. `summarizeStackingPosition` input shape matches its consumers' wiring (`stStxBalance`, `microStxPerStStx`, `poxLockedStx`, `poxIsStacking`).
- **Commit boundary caveat:** Tasks 5 and 7 share one commit because the file moves dangle `AssetsPageContent` imports until the trim — documented in both tasks so the tree is green at every commit.
