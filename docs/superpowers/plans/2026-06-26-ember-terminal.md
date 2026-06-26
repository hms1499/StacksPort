# Ember Terminal Visual Identity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin StacksPort with a distinctive "Ember Terminal" identity — warm-ink surfaces, Bitcoin-ember + Stacks-violet accents, mono numerals, hairline borders, near-sharp corners — in both light and dark mode.

**Architecture:** The app is CSS-token-driven (`src/app/globals.css` → `:root` / `.dark` / `@theme`). Palette and geometry change by editing token values in that one file; mono numerals are applied selectively at high-value numeric call sites via a `.font-data` utility. No component DOM/logic changes.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4 (`@theme`), next/font (Syne + JetBrains Mono), CSS custom properties.

## Global Constraints

- Visual only. NO changes to `contracts/`, `keeper-bot/`, API routes, business logic, or i18n strings.
- Both modes: every token added/changed must be set in BOTH `:root` (light) and `.dark`.
- Semantics fixed: positive = green, negative = red (NOT brand-colored).
- Ember (`#F7931A`) as TEXT on light paper fails WCAG AA → use `--accent-text` (`#B45F09`) for text/icon-grade accent in light; `--accent` stays the vivid fill.
- Mono numerals: high-value numeric points ONLY (balances, prices, big stats, amounts, chart labels, micro-labels). NOT every number app-wide.
- Mono font is the next/font CSS var `--font-mono` (JetBrains Mono), defined in `src/app/[locale]/layout.tsx`.
- After EVERY task: `npm run build` must pass and `npm run lint` must be clean before commit.
- Commit messages: no `Co-Authored-By` trailer (project convention).

---

## Phase 1 — Palette re-skin

### Task 1: Dark mode "warm ink" tokens

**Files:**
- Modify: `src/app/globals.css:87-140` (the `.dark` block)

**Interfaces:**
- Produces: dark values for `--bg-*`, `--border-*`, `--accent*`, `--text-*`, `--positive/negative/warning`, `*-soft`.

- [ ] **Step 1: Rewrite the `.dark` surface/border/accent/text/semantic tokens**

Replace the corresponding lines inside `.dark` with:
```css
  --bg-base:     #14110D;
  --bg-surface:  #1B1712;
  --bg-card:     #221D16;
  --bg-elevated: #2A241C;

  --border-subtle:  #2A241C;
  --border-default: #3A3228;
  --border-active:  rgba(247, 147, 26, 0.35);

  --accent:       #F7931A;
  --accent-bright:#FFA733;
  --accent-dim:   rgba(247, 147, 26, 0.10);
  --accent-glow:  rgba(247, 147, 26, 0.20);

  --text-primary:   #F2EBDF;
  --text-secondary: #9A8E7C;
  --text-muted:     #6E6356;

  --positive: #3FB950;
  --negative: #F0506E;
  --warning:  #FBBF24;

  --positive-soft: rgba(63, 185, 80, 0.12);
  --negative-soft: rgba(240, 80, 110, 0.12);
  --brand-soft:    rgba(247, 147, 26, 0.12);
```
(Leave `--dca-*`, `--hero-*`, `--shadow-*`, `--background`, `--foreground` for Task 4.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS (no CSS/type errors).

- [ ] **Step 3: Visual verify (dark)**

Run `npm run dev`, open `http://localhost:3000/dashboard` in dark mode. Expected: warm-ink background, ember accents, off-white text. No green remaining except positive %.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): dark warm-ink + ember tokens (Ember Terminal)"
```

---

### Task 2: Light mode "warm paper" tokens + accent-text split

**Files:**
- Modify: `src/app/globals.css:28-85` (the `:root` block)

**Interfaces:**
- Produces: light values + NEW token `--accent-text` (also defined in `.dark` as alias).

- [ ] **Step 1: Rewrite the `:root` surface/border/accent/text/semantic tokens**

Replace the corresponding lines inside `:root` with:
```css
  --bg-base:     #F5F0E8;
  --bg-surface:  #FFFDFA;
  --bg-card:     #FFFFFF;
  --bg-elevated: #FBF7F0;

  --border-subtle:  #ECE3D4;
  --border-default: #DCCFBA;
  --border-active:  rgba(217, 122, 15, 0.40);

  --accent:       #F7931A;
  --accent-bright:#FFA733;
  --accent-dim:   rgba(247, 147, 26, 0.12);
  --accent-glow:  rgba(247, 147, 26, 0.22);
  --accent-text:  #B45F09;

  --text-primary:   #1A140D;
  --text-secondary: #6E6356;
  --text-muted:     #9A8E7C;

  --positive: #1F9D45;
  --negative: #D63B5C;
  --warning:  #B45309;

  --positive-soft: rgba(31, 157, 69, 0.10);
  --negative-soft: rgba(214, 59, 92, 0.10);
  --brand-soft:    rgba(247, 147, 26, 0.12);
```

- [ ] **Step 2: Add `--accent-text` alias in `.dark`**

In the `.dark` block (after `--accent-glow`), add:
```css
  --accent-text:  #F7931A;
```
(In dark, ember already passes as text, so it aliases `--accent`.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Visual verify (light)**

Open `http://localhost:3000/dashboard` in light mode. Expected: warm cream surfaces, dark warm text, ember accents readable.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): light warm-paper tokens + accent-text split"
```

---

### Task 3: Add Stacks-violet secondary accent + theme bridge

**Files:**
- Modify: `src/app/globals.css` (`:root`, `.dark`, and the `@theme inline` color bridge at `:162-175`)

**Interfaces:**
- Produces: `--accent-2`, `--accent-2-dim` (both modes); Tailwind utility `text-accent-2` / `bg-accent-2` via `--color-accent-2`.

- [ ] **Step 1: Add violet tokens to `:root`**

In `:root` (after `--accent-text`):
```css
  --accent-2:     #6D4FE0;
  --accent-2-dim: rgba(109, 79, 224, 0.12);
```

- [ ] **Step 2: Add violet tokens to `.dark`**

In `.dark` (after `--accent-text`):
```css
  --accent-2:     #8A6BFF;
  --accent-2-dim: rgba(138, 107, 255, 0.12);
```

- [ ] **Step 3: Expose via theme bridge**

In the `@theme inline` color block (around line 162-175), add:
```css
  --color-accent-2:      var(--accent-2);
  --color-accent-2-dim:  var(--accent-2-dim);
  --color-accent-text:   var(--accent-text);
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): add Stacks-violet secondary accent token + bridge"
```

---

### Task 4: Reconcile DCA / hero / shadow tokens to ember/violet

**Files:**
- Modify: `src/app/globals.css` (`--dca-*`, `--hero-*`, `--shadow-*` in both `:root` and `.dark`)

**Interfaces:**
- Produces: warm DCA gradients (in = ember→violet, out = violet→rose), warm hero radials, warm shadows.

- [ ] **Step 1: Update `:root` DCA/hero/shadow**

Replace those token groups in `:root` with:
```css
  --dca-in-from:   #F7931A;
  --dca-in-to:     #6D4FE0;
  --dca-in-glow:   rgba(109, 79, 224, 0.22);

  --dca-out-from:  #6D4FE0;
  --dca-out-to:    #D63B5C;
  --dca-out-glow:  rgba(214, 59, 92, 0.20);

  --hero-bg-dca-in:  radial-gradient(ellipse 100% 80% at 50% 0%,
                       rgba(247, 147, 26, 0.12) 0%,
                       rgba(109, 79, 224, 0.08) 50%,
                       transparent 100%);
  --hero-bg-dca-out: radial-gradient(ellipse 100% 80% at 50% 0%,
                       rgba(109, 79, 224, 0.10) 0%,
                       rgba(214, 59, 92, 0.08) 50%,
                       transparent 100%);

  --shadow-card:       0 1px 3px rgba(40, 28, 12, 0.06);
  --shadow-card-hover: 0 8px 24px rgba(40, 28, 12, 0.10);
```

- [ ] **Step 2: Update `.dark` DCA/hero/shadow**

Replace those token groups in `.dark` with:
```css
  --dca-in-from:   #FFA733;
  --dca-in-to:     #8A6BFF;
  --dca-in-glow:   rgba(138, 107, 255, 0.28);

  --dca-out-from:  #8A6BFF;
  --dca-out-to:    #F0506E;
  --dca-out-glow:  rgba(240, 80, 110, 0.26);

  --hero-bg-dca-in:  radial-gradient(ellipse 100% 80% at 50% 0%,
                       rgba(255, 167, 51, 0.10) 0%,
                       rgba(138, 107, 255, 0.06) 50%,
                       transparent 100%);
  --hero-bg-dca-out: radial-gradient(ellipse 100% 80% at 50% 0%,
                       rgba(138, 107, 255, 0.08) 0%,
                       rgba(240, 80, 110, 0.06) 50%,
                       transparent 100%);

  --shadow-card:       0 1px 3px rgba(0, 0, 0, 0.35);
  --shadow-card-hover: 0 8px 24px rgba(0, 0, 0, 0.45);
```

- [ ] **Step 3: Build + visual verify DCA page (both modes)**

Run: `npm run build`; open `/dca` in light and dark. Expected: DCA-in hero ember→violet, no teal/green gradients remain.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): retint DCA/hero/shadow tokens to ember/violet"
```

---

## Phase 2 — Sharpen geometry

### Task 5: Override Tailwind radius scale + shadcn radius

**Files:**
- Modify: `src/app/globals.css` (add a `@theme` block; lower the `--radius` custom prop at `:84`)

**Interfaces:**
- Produces: sharper `rounded-md/lg/xl/2xl` across all 134 consumers; sharper shadcn primitives via `--radius`.

- [ ] **Step 1: Lower the shadcn `--radius` custom prop**

Change `src/app/globals.css:84` from `--radius: 0.625rem;` to:
```css
  --radius: 0.25rem;
```

- [ ] **Step 2: Add a radius-scale `@theme` override**

After the existing `@theme inline` color block, add a new block:
```css
/* Ember Terminal: sharpen the global radius scale. rounded-md/lg/xl/2xl all
   resolve here, so 134 surfaces sharpen at once without per-file edits. */
@theme {
  --radius-sm:  0.125rem; /* 2px */
  --radius-md:  0.1875rem; /* 3px */
  --radius-lg:  0.25rem;  /* 4px */
  --radius-xl:  0.3125rem; /* 5px */
  --radius-2xl: 0.375rem; /* 6px */
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Visual spot-check**

Open `/dashboard`, `/trade`, `/dca`, and open a TxSheet (e.g. Stake modal on `/earn`). Expected: cards, buttons, inputs, modals all read near-sharp (≤6px), consistent. If one specific surface looks wrong, note it — do NOT mass-edit; a per-surface override is a follow-up.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): sharpen global radius scale for terminal geometry"
```

---

## Phase 3 — Mono data identity

### Task 6: Add `.font-data` utility

**Files:**
- Modify: `src/app/globals.css` (add the class, e.g. after the radius block)

**Interfaces:**
- Produces: class `.font-data` → JetBrains Mono + tabular numerals. Consumed by Tasks 7-10.

- [ ] **Step 1: Add the utility class**

```css
/* High-value numeric identity: JetBrains Mono + tabular figures so columns of
   numbers align and animated counters don't jitter widths. Applied selectively
   (balances, prices, big stats, amounts, chart/micro-labels) — NOT global. */
.font-data {
  font-family: var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): add .font-data mono-numeral utility"
```

---

### Task 7: Mono on AnimatedCounter call sites

**Files:**
- Modify: `src/components/dashboard/BalanceCard.tsx`
- Modify: `src/components/assets/PortfolioSummary.tsx`
- Modify: `src/components/dca/DCAHeroStats.tsx`
- Modify: `src/components/earn/YieldSummaryHero.tsx`
- Modify: `src/components/dashboard/SocialProofStrip.tsx`

**Interfaces:**
- Consumes: `.font-data` (Task 6). `AnimatedCounter` already forwards its `className` prop onto the rendered `<span>` (`src/components/motion/AnimatedCounter.tsx:57`).

- [ ] **Step 1: Add `font-data` to each `<AnimatedCounter>` value**

In each file, locate the `<AnimatedCounter ... />` that renders the headline number and merge `font-data` into its `className`. If it has no `className`, add `className="font-data"`; if it has one, append it, e.g.:
```tsx
<AnimatedCounter
  value={portfolioValue}
  className="font-data text-3xl font-extrabold tracking-tight"
  formatFn={formatUsd}
/>
```
Do this for the primary value(s) in all five files. Leave small secondary labels alone unless they are numeric stats.

- [ ] **Step 2: Build + lint**

Run: `npm run build && npm run lint`
Expected: PASS, clean.

- [ ] **Step 3: Visual verify**

Open `/dashboard`, `/assets`, `/dca`, `/earn`. Expected: headline numbers render in mono, no width jitter on the counter animation.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/BalanceCard.tsx src/components/assets/PortfolioSummary.tsx src/components/dca/DCAHeroStats.tsx src/components/earn/YieldSummaryHero.tsx src/components/dashboard/SocialProofStrip.tsx
git commit -m "feat(ui): mono numerals on portfolio/DCA/yield counters"
```

---

### Task 8: Mono on AmountField input

**Files:**
- Modify: `src/components/tx/AmountField.tsx:30-36` (the numeric `<input>`)

**Interfaces:**
- Consumes: `.font-data`. AmountField is the shared amount input used across earn/swap/DCA TxSheets.

- [ ] **Step 1: Add `font-data` to the input className**

Change the input's className from:
```tsx
className="w-full rounded-xl px-3 py-2.5 text-sm bg-transparent border"
```
to:
```tsx
className="font-data w-full rounded-xl px-3 py-2.5 text-base bg-transparent border"
```
(Also bump `text-sm`→`text-base` so the typed amount reads as a primary value.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Visual verify**

Open a TxSheet with an amount field (Stake on `/earn`). Type digits — expected mono, tabular, aligned.

- [ ] **Step 4: Commit**

```bash
git add src/components/tx/AmountField.tsx
git commit -m "feat(ui): mono numerals in shared AmountField"
```

---

### Task 9: Mono on market & stat displays

**Files:**
- Modify: `src/components/dashboard/STXMarketStats.tsx`
- Modify: `src/components/dashboard/DCAPerformanceCard.tsx`
- Modify: `src/components/earn/StackingTracker.tsx`
- Modify: `src/components/assets/drawer/MarketStats.tsx`

**Interfaces:**
- Consumes: `.font-data`.

- [ ] **Step 1: Add `font-data` to numeric value elements**

In each file, add the `font-data` class to the `<span>`/`<div>` that renders a numeric value or percentage (price, APY, market cap, volume, cycle counts, cost basis). Add it ONLY to the value element, not its text label. Example:
```tsx
<span className="font-data text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
  {value}
</span>
```

- [ ] **Step 2: Build + lint**

Run: `npm run build && npm run lint`
Expected: PASS, clean.

- [ ] **Step 3: Visual verify**

Open `/dashboard`, `/earn`, and the asset detail drawer on `/assets`. Expected: stat numbers mono; labels stay Syne.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/STXMarketStats.tsx src/components/dashboard/DCAPerformanceCard.tsx src/components/earn/StackingTracker.tsx src/components/assets/drawer/MarketStats.tsx
git commit -m "feat(ui): mono numerals on market & stat readouts"
```

---

### Task 10: Uppercase mono micro-labels on card headers

**Files:**
- Modify: `src/components/dashboard/BalanceCard.tsx`
- Modify: `src/components/dashboard/STXMarketStats.tsx`
- Modify: `src/components/earn/YieldSummaryHero.tsx`

**Interfaces:**
- Consumes: `.font-data`. This is the terminal "tell" — small uppercase mono section labels.

- [ ] **Step 1: Restyle the small section-label above each card's headline**

For the small caption/label above the headline value (e.g. "Portfolio", "Market", "Yield"), apply the micro-label treatment:
```tsx
<span className="font-data text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
  {label}
</span>
```
Only the one primary section label per card — do not uppercase every label.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Visual verify**

Open `/dashboard`, `/earn`. Expected: micro uppercase mono labels above headline numbers; terminal feel reads.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/BalanceCard.tsx src/components/dashboard/STXMarketStats.tsx src/components/earn/YieldSummaryHero.tsx
git commit -m "feat(ui): uppercase mono micro-labels on card headers"
```

---

## Phase 4 — Violet as secondary

### Task 11: Violet on DCA surfaces

**Files:**
- Modify: DCA components that currently hardcode the old single-accent for secondary emphasis. Start with `src/components/dca/DCAHeroStats.tsx` and the DCA-in panel `src/components/dca/performance/DCAInPanel.tsx`.

**Interfaces:**
- Consumes: `--accent-2` / `--accent-2-dim` (Task 3) and the DCA gradient tokens (Task 4).

- [ ] **Step 1: Apply violet to a secondary DCA accent**

Where a DCA stat or badge uses `var(--accent)` purely for secondary emphasis (e.g. the "next execution" countdown, a secondary chip), switch it to `var(--accent-2)` (text/icon) or `var(--accent-2-dim)` (fill). Keep the primary CTA on ember. Example:
```tsx
<span style={{ color: "var(--accent-2)" }}>{nextRun}</span>
```

- [ ] **Step 2: Build + lint**

Run: `npm run build && npm run lint`
Expected: PASS, clean.

- [ ] **Step 3: Visual verify**

Open `/dca`. Expected: ember = primary CTA, violet = secondary stat — dual-accent reads, not muddy.

- [ ] **Step 4: Commit**

```bash
git add src/components/dca/DCAHeroStats.tsx src/components/dca/performance/DCAInPanel.tsx
git commit -m "feat(ui): violet secondary accent on DCA surfaces"
```

---

### Task 12: Violet on Stacks-AI surface, sBTC badges & secondary links

**Files:**
- Modify: `src/components/ai/AIPageContent.tsx` (header/accent of the Stacks AI surface)
- Modify: the sBTC badge / secondary-link components surfaced in earn (e.g. the stStx position line / unstake link in `src/components/earn/`). Identify the exact file with `grep -rn "unstake\|sBTC" src/components/earn`.

**Interfaces:**
- Consumes: `--accent-2` / `--accent-2-dim`.

- [ ] **Step 1: Apply violet to the Stacks-AI accent**

In `AIPageContent.tsx`, where the Sparkles icon / "Stacks AI" heading uses `var(--accent)`, switch that accent to `var(--accent-2)` so AI gets the "second voice".

- [ ] **Step 2: Apply violet to sBTC badge + secondary unstake link**

Switch those secondary links/badges from `var(--accent)` to `var(--accent-2)`.

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: PASS, clean.

- [ ] **Step 4: Visual verify**

Open `/ai` and `/earn`. Expected: AI header + sBTC/unstake accents are violet; primary CTAs remain ember.

- [ ] **Step 5: Commit**

```bash
git add src/components/ai/AIPageContent.tsx src/components/earn
git commit -m "feat(ui): violet accent on Stacks-AI, sBTC badges & secondary links"
```

---

## Phase 5 — Final verification

### Task 13: Full gate + manual dual-mode pass

**Files:**
- None (verification only; commit any fixes found).

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: E2E (chromium)**

Run: `npx playwright test --project=chromium`
Expected: green (only visuals changed; DOM/flows untouched). Investigate any failure — do not skip.

- [ ] **Step 4: Manual visual pass — BOTH modes**

Toggle light + dark and walk: `/dashboard`, `/assets`, `/trade`, `/dca`, `/earn`, open a TxSheet, sidebar, mobile bottom nav. Checklist:
- No leftover green/teal/navy from old palette (except positive=green).
- Light-mode ember text uses `--accent-text` and is readable (AA).
- Headline numbers + stats + amounts render mono; labels stay Syne.
- Corners consistently sharp; no rogue large radius.
- Dual accent: ember primary, violet secondary, not muddy.

- [ ] **Step 5: Free port 3000**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null || true`

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(theme): Ember Terminal verification pass adjustments"
```
(Skip if nothing changed.)

---

## Self-Review

**Spec coverage:** Phase 1 tokens (Tasks 1-4) ✓ light+dark+violet+DCA/hero/shadow; Phase 2 geometry (Task 5) ✓; Phase 3 mono — counters/AmountField/stats/micro-labels (Tasks 6-10) ✓; Phase 4 violet secondary (Tasks 11-12) ✓; testing/contrast/e2e (Task 13) ✓; accent-text contrast mitigation (Task 2) ✓; out-of-scope respected (no contracts/keeper/api). All spec sections map to a task.

**Placeholder scan:** Component edits name exact files + exact class + example snippet; two spots (Task 11/12) instruct a `grep` to confirm the precise current accent line before swapping — this is verification of existing code, not a missing value. No TBD/TODO.

**Type/name consistency:** `.font-data` defined Task 6, consumed Tasks 7-10 by that exact name; `--accent-2`/`--accent-2-dim`/`--accent-text` defined Tasks 2-3, consumed Tasks 11-12; `AnimatedCounter` className forwarding confirmed at `AnimatedCounter.tsx:57`.
