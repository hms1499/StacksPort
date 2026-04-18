# DCA Tab Full Redesign — Design Spec

**Date:** 2026-04-18
**Status:** Design — awaiting user review
**Scope:** `src/app/dca/**`, `src/components/dca/**`, `src/components/dca-out/**`, new tokens in `src/app/globals.css`

## Goals & Non-Goals

### Goals
- Redesign DCA tab UI to match "DeFi modern" aesthetic (glass-morphism, gradient, glow)
- Distinguish DCA In vs DCA Out visually via dual gradient (green→cyan vs orange→pink)
- Adopt a Hero + Dashboard layout with integrated tab switching
- Replace current flat plan cards with a hybrid collapsed-row / rich-expanded-tabs pattern
- Give the create-plan form a live preview panel and preset chips
- Ship mobile-first responsive layout on par with desktop
- Keep motion intensity subtle (perf-first) — reuse existing `AnimatedPage`, `StaggerChildren`, `AnimatedCounter`, `MotionCard`

### Non-Goals
- No change to DCA contract logic, backend APIs, or data models
- No new charting library (sparkline is hand-rolled SVG)
- No particles, 3D tilt, mouse-tracking gradient, or GSAP scroll-trigger
- No redesign of Topbar, BottomNav, or other app-level shells
- History timeline data wiring is out of scope for v1 (placeholder only)
- Accessibility audit (keyboard, ARIA, reduced-motion) is not a blocking goal — followed where natural but not separately verified

## Decisions Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Aesthetic = DeFi modern (glass + gradient + glow) | Matches existing `glass-card`, `--accent-glow` primitives |
| 2 | Dual gradient: DCA In green→cyan, DCA Out orange→pink | Visual differentiation of the two modes |
| 3 | Layout = Hero + Dashboard | Preserves user mental model; adds "wow factor" via hero stats |
| 4 | Motion = subtle (perf-first) | Avoids TikTok-crypto feel; reuses existing motion primitives |
| 5 | Hero metrics = 2 protocol + 2 user | Balance protocol confidence with personal relevance |
| 6 | Plan card = hybrid (collapsed row / tabbed expand) | Info-dense when scanning, full detail when acting |
| 7 | Form = input + preset chips + live preview | Quick-fill for common values; transparency on what user is signing up for |
| 8 | Mobile-first equal | DCA users check status on mobile frequently |
| 9 | Tab switcher = hero-integrated (gradient bg shifts) | Tab is the "mode switch" — treat it as such |

## Architecture

### Page Component Tree

```
DCAPageContent (orchestrator — state for tab + refresh keys)
├── Topbar
├── DCAHeroSection               (NEW)
│   ├── DCATabsIntegrated        (pill tabs in hero)
│   ├── DCAHeroStatsProtocol     (TVL + total swaps)
│   └── DCAHeroStatsUser         (active plans + next swap | Connect CTA)
├── DCAMainGrid
│   ├── DCACreateForm | DCACreateOutForm
│   │   └── LivePreviewCard
│   └── MyPlans | MyOutPlans
│       └── PlanCard | OutPlanCard
│           ├── PlanCardRow          (collapsed)
│           └── PlanCardExpanded     (tabs)
│               ├── OverviewTab
│               │   └── MiniSparkline
│               ├── ExecuteTab
│               └── HistoryTab
└── InfoFooter
```

### File Layout

```
src/components/dca/
├── DCAPageContent.tsx       (refactor)
├── DCAHeroSection.tsx       (NEW)
├── DCAHeroStats.tsx         (NEW — count-up metrics)
├── CreatePlanForm.tsx       (refactor)
├── LivePreviewCard.tsx      (NEW — shared with dca-out)
├── MyPlans.tsx              (refactor — add empty state w/ presets)
├── PlanCard.tsx             (refactor — split into row + expanded tabs)
├── PlanCardTabs/
│   ├── OverviewTab.tsx      (NEW)
│   ├── ExecuteTab.tsx       (extract existing logic)
│   └── HistoryTab.tsx       (NEW — placeholder for v1)
├── MiniSparkline.tsx        (NEW — inline SVG)
└── InfoFooter.tsx           (NEW)

src/components/dca-out/      (mirror structure)
```

### Design Tokens — additions to `globals.css`

```css
:root {
  /* DCA In — green→cyan */
  --dca-in-from:   #00C27A;
  --dca-in-to:     #06B6D4;
  --dca-in-glow:   rgba(6, 182, 212, 0.25);

  /* DCA Out — orange→pink */
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
}

.dark {
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
}
```

### New Utility Classes

```css
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
```

## Section-by-Section Designs

### 1. Hero Section (with integrated tabs)

**Structure:**
- Single rounded card (`rounded-3xl`, `var(--shadow-card)`), bg uses `--hero-bg-dca-in` or `--hero-bg-dca-out` depending on active tab
- `background` transitions over 300ms ease when tab switches
- Top row: left = `[● DCA In][○ DCA Out]` pill tabs; right = 2 protocol metrics stacked horizontally (TVL, total swaps) with trend delta
- Divider (subtle `border-default` line)
- Bottom row: 2 user metrics (Active plans, Next swap countdown) OR Connect CTA if not connected

**Pill tabs:**
- Active = solid white bg + `var(--shadow-card)`, text = primary
- Inactive = transparent, text = `--text-muted`, 50% opacity
- Click → bg of hero shifts (tab switch)

**Metrics:**
- Large numeric value (`text-3xl font-bold font-data`, tabular-nums)
- Small label below (`text-xs --text-muted`)
- Optional trend chip: `▲ +2.1%` in `--positive` or `▼ -1.4%` in `--negative`
- Use `AnimatedCounter` for count-up on mount / update

**Mobile:**
- Stack vertically: tabs → description → 2 protocol metrics in 2 cols → 2 user metrics in 2 cols
- Hero bg gradient identical on mobile

### 2. Create Plan Form (left column, sticky on desktop)

**Changes vs current:**
- Replace hardcoded `#408A71` / `#B0E4CC` with CSS vars + gradient tokens
- Source/target token rows: keep as read-only display
- **Amount per swap:** input + 3 preset chips beside (`10 / 50 / 100 STX` for DCA In; `0.001 / 0.005 / 0.01 sBTC` for DCA Out). Preset values are best-effort defaults; revisit with telemetry later
- **Frequency:** chip group (Daily / Weekly / Biweekly) — already exists, restyled with gradient for active state
- **Initial deposit:** input + percentage chips `25% / 50% / Max` of balance (replaces plain Max button)
- **NEW — LivePreviewCard:**
  - Renders only when `amt > 0 && dep >= amt`
  - Lines: number of swaps, end-date estimate, estimated output at current price, total protocol fee
  - Uses `gradient-border-dca-in` / `gradient-border-dca-out`
  - Warning state (amber border) when validation fails
- **CTA button:** `gradient-dca-in` / `gradient-dca-out` background, white text, subtle glow on hover

**Mobile:**
- Full-width form, not sticky
- Preview card stays inline under deposit input (not sticky-bottom — simpler, less chrome)
- Preset chips wrap when container is narrow

### 3. Plans List & Plan Card (right column)

**Collapsed row (desktop):**
```
[icon pair] STX→sBTC · Plan #12 · Weekly        50.00 STX / swap    [▾]
● Active   ┃█████████░░░░░░░┃ 58%  ·  7 of 12 swaps  ·  350 STX left
⏱ Ready now  [⚡ Execute]
```

- Compact 3-line row, clickable
- Status dot uses `--positive` / `--warning` / `--text-muted`
- Progress bar uses `gradient-dca-in` / `gradient-dca-out` fill
- "Ready now" + inline Execute shortcut when executable

**Collapsed row (mobile):** stacks to 2 rows of content + full-width progress bar below.

**Expansion behavior:** click row → expand; opening one plan collapses others (one-at-a-time scroll discipline). Height + opacity transition over 250ms via `AnimatePresence`.

**Expanded view — inner tabs:**
1. **Overview (default):**
   - Left: stats grid (Swaps, Spent, Avg output, Since)
   - Right: `MiniSparkline` — 7d sBTC price, hand-rolled SVG polyline
   - Below: action row `[+ Deposit more] [⏸ Pause / ▶ Resume] [🗑 Cancel & Refund]`
2. **Execute:** existing quote + slippage + router + button flow, restyled with gradient border and var-based colors
3. **History:** timeline list of past swaps. **v1 = placeholder** (`"History coming soon"` with empty-state icon). Phase 2 will index `plan-executed` events

**Cancel modal:** keep existing, swap hardcoded colors for vars, backdrop stays `bg-black/40 backdrop-blur-sm`.

### 4. Info Footer

- Keep 3 cards, grid `1/2/3 cols` by breakpoint
- Add icon container (`w-10 h-10 rounded-xl bg: --accent-dim`, icon color `--accent`)
- Lucide icons (not emoji): `TrendingUp` / `Coins` / `ShieldCheck` for DCA In; `TrendingDown` / `Coins` / `ShieldCheck` for DCA Out
- Hover: lift 2px + shadow-card-hover, 150ms transition

### 5. Empty & Loading & Error States

**Wallet disconnected:**
- Large rounded card with subtle hero-bg gradient echo
- Gradient icon chip (👛 via Lucide `Wallet`)
- Heading + description + Connect CTA (reuse `ConnectWalletCTA`)
- Footer line listing supported wallets

**Connected, no plans:**
- Icon + heading + description
- "Try a preset" chips that fill the form on click (e.g. `10 STX weekly`, `50 STX biweekly`)
- Note: preset chips in empty state are a nice-to-have; if time-constrained, ship plain empty state

**Loading:**
- Hero stats: skeleton blocks using `.animate-shimmer`, same dimensions as final values
- Plans list: 3 skeleton rows matching collapsed row layout
- Form submit: existing button-level spinner with disabled state

**Error:**
- Plans fetch failure: inline error card with `--negative` icon + Retry button
- Tx failure: notification (via existing `addNotification`) + plan card flash border `--negative` for 2s
- Wallet disconnect mid-session: fall back to empty state; scroll position preserved

## Motion Catalog (subtle intensity)

| Element | Effect | Implementation |
|---|---|---|
| Page mount | Fade + 4px rise, 200ms | Existing `AnimatedPage` |
| Card list stagger | 40ms between children, 150ms each | Existing `StaggerChildren` |
| Hero tab switch | Background gradient crossfade, 300ms ease | CSS `transition: background 300ms ease` |
| Hero stats value | Count-up on mount / update, 400ms | Existing `AnimatedCounter` |
| Plan card expand | Height + opacity, 250ms | Framer Motion `AnimatePresence` |
| Plan card hover | `translateY(-1px)` + shadow, 150ms | CSS transition |
| Button hover | Shadow + brightness 1.03, 120ms | CSS transition |
| CTA gradient | Static — not animated | (explicit non-choice for perf) |
| Tx success | One pulse-glow cycle | Existing `.animate-pulse-glow` |
| Value change flash | Positive/negative 500ms | Existing `.flash-positive` / `.flash-negative` |
| Skeleton loading | Shimmer sweep 1.8s loop | Existing `.animate-shimmer` |

**Explicitly excluded:** particles, 3D tilt, mouse-tracking gradient, GSAP scroll-trigger, animated gradient backgrounds.

## Data Dependencies

| Feature | Data source | v1 status |
|---|---|---|
| Hero: TVL | Existing `DCAStats` source | Wire |
| Hero: total swaps | Existing `DCAStats` source | Wire |
| Hero: active plans (user) | Compute from existing `fetchPlans(address)` | Wire |
| Hero: next swap countdown | Compute min of `leb + ivl - currentBlock` across user's active plans | Wire |
| Live preview estimated output | Current pool quote at form values | Wire (already queried in PlanCard Execute tab — extract helper) |
| Mini sparkline (7d price) | Tenero or pool quote history | **Placeholder** — render flat dashed line with "price chart coming soon" tooltip; wire in phase 2 |
| History tab | Contract `plan-executed` events via Hiro API | **Placeholder** — empty-state card in v1 |

## Out of Scope for v1

- History timeline data wiring
- Mini sparkline actual price data
- Accessibility audit (keyboard nav, ARIA labels, `prefers-reduced-motion` honoring — followed where natural, not separately verified)
- Preset chip values backed by telemetry (using best-guess defaults)
- Server-side caching / ISR for hero stats

## Open Questions for Implementation Plan

1. Is `framer-motion` already a dependency? (Seen via `MotionCard`, so yes — confirm version supports `AnimatePresence` with `mode="popLayout"` for the one-at-a-time expand pattern)
2. Where to extract the shared pool quote helper from `PlanCard.tsx` so both `LivePreviewCard` and `ExecuteTab` use it?
3. Should `DCAHeroStats` live under `dca/` or in a shared location (since both In and Out use it with different metrics)?

These will be resolved during plan-writing.
