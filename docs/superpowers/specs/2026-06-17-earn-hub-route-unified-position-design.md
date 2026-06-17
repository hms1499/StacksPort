# Earn Hub v2 — Dedicated `/earn` Route + Unified Stacking Position

**Date:** 2026-06-17
**Status:** Approved design, ready for implementation plan
**Builds on:** [`2026-06-16-earn-hub-liquid-stacking-design.md`](2026-06-16-earn-hub-liquid-stacking-design.md) (v1)

## 1. Overview & Goal

Earn Hub v1 shipped the first in-app yield *action* (stake STX → stSTX via StackingDAO),
the idle-STX nudge, and the stake modal — all bolted onto the existing `/assets`
surface. v1 §42 explicitly deferred a dedicated route to "a fast follow once there is
more than one in-app action to host," and v1 step 8 (unified position display +
unstake) was left unfinished.

This slice delivers that fast follow **and** finishes the deferred position work:

1. **Dedicated `/earn` route** — a real Earn hub page, reachable from sidebar, bottom
   nav, and command palette. Stacking/yield content moves here; `/assets` keeps a
   small summary card that links into it.
2. **Unified stacking position** — `StackingTracker` understands **both** liquid
   stacking (stSTX via StackingDAO) **and** native PoX. Today a user who liquid-stakes
   holds stSTX but `StackingTracker` still reads PoX-only and shows **"Not Stacking"** —
   a coherence bug. After this slice, either form (or both) renders an "Active" position.

### Explicit non-goal (deferred to the next slice)

- **Working instant unstake.** v1 §81/step 8 described unstake as a "deep-link to the
  existing swap (stSTX→STX)", but `SWAP_TOKENS` / `ROUTE_TABLE` in
  `src/lib/domain/swap/` contain **only stx, sbtc, usdcx — there is no stSTX token and
  no stSTX↔STX route**. So a real unstake is blocked on adding that route (a verified
  on-chain pool + a new `RouteSpec` + a `senderSpendPostCondition` branch + new
  characterization tests). That is its own risk-isolated slice. **In this slice the
  Unstake control renders as a disabled "coming soon" affordance** (or an external link
  to the StackingDAO app), nothing more.

This split is deliberate: Slice 1 here is frontend-only and ships safely; the on-chain
route work that real unstake needs lands separately after its pool is verified against
the Hiro API.

## 2. Key Decisions

| Decision | Choice |
|----------|--------|
| Route | New `/earn` page under `src/app/[locale]/earn/` |
| `/assets` relationship | **Approach A** — move stacking/yield to `/earn`; `/assets` keeps a small summary card linking across (single source of truth) |
| Components moved | `StackingTracker`, `YieldOpportunities`, `StakeStxModal` (used within), `IdleStxNudge` |
| Position model | `StackingTracker` unifies **liquid stSTX** + **native PoX**; "Not Stacking" only when both are zero |
| stSTX → STX valuation | Reuse `fetchStxPerStStx` (already in `stacking-dao.ts`) × stSTX balance from `useTokensWithValues` |
| Unstake (this slice) | Disabled "coming soon" affordance — real instant-unstake deferred to the route slice |
| Nav surfaces | `Sidebar.tsx`, `BottomNav.tsx`, `CommandPalette.tsx` + i18n `nav.earn` in all 4 locales |

## 3. Architecture

### Routing & page shell
- `src/app/[locale]/earn/page.tsx` — metadata + canonical `/earn`, renders an
  `EarnPageWrapper` (mirrors `AssetsPageWrapper` mount pattern).
- `src/components/earn/EarnPageContent.tsx` — `"use client"`, mirrors
  `AssetsPageContent` shell (Topbar, `AnimatedPage`, `StaggerChildren`, `MotionCard`).
  Lays out, top to bottom: unified `StackingTracker`, `IdleStxNudge`,
  `YieldOpportunities`. No tab bar in v2 (single-purpose page); tabs can come later if
  the hub grows.

### Component moves (no behavior change beyond unification)
- Move `StackingTracker.tsx`, `YieldOpportunities.tsx`, `StakeStxModal.tsx`,
  `IdleStxNudge.tsx` from `src/components/assets/` to `src/components/earn/`. Update all
  imports. (Keep `SBTCMonitor` on `/assets` positions — it monitors sBTC, it is not a
  stacking action.)
- `AssetsPageContent.tsx`:
  - Remove `IdleStxNudge` and `YieldOpportunities` from the **overview** tab; drop
    `StackingTracker` from the **positions** tab (positions keeps `SBTCMonitor`).
  - Add `EarnSummaryCard` to the overview tab in place of `YieldOpportunities`.

### `EarnSummaryCard` (new, on `/assets`)
- `src/components/assets/EarnSummaryCard.tsx` — compact card: "Earning ~N STX" (sum of
  liquid stSTX-in-STX + native PoX locked STX) + estimated APY chip + `Link` to `/earn`.
  Reuses the same unified-position helper (§ below) so the number can't drift from the
  Earn page. When nothing is earning, shows a one-line "Put idle STX to work → Earn" CTA.

### Unified position (pure logic, TDD)
- `src/lib/domain/stacking/position.ts` (+ `position.test.ts`):
  - `summarizeStackingPosition(input): StackingSummary` — pure function combining
    - liquid: `{ stStxBalance, stxPerStStx }` → STX-equivalent of stSTX,
    - native PoX: `{ lockedSTX, isStacking }` from `StackingStatus`,
    - into `{ isEarning, liquidStx, poxStx, totalStx }`.
  - No fetch. Inputs are already-fetched values; the component wires the reads.
- `StackingTracker.tsx`:
  - Read stSTX balance via `useTokensWithValues` (symbol `stSTX`) and the rate via
    `fetchStxPerStStx` (best-effort; null hides the liquid value, never blocks).
  - Keep `useStackingStatusSnap` for PoX.
  - Render a **liquid section** (stSTX position in STX + USD, est. APY, disabled
    "Unstake — coming soon") and the existing **PoX section** (lock/cycle/unlock).
  - Status badge "Active" when `summary.isEarning`; "Not Stacking" only when both zero.

### Reads (reuse, don't rebuild)
- stSTX balance: `useTokensWithValues` (already used by `YieldOpportunities`).
- Rate: `fetchStxPerStStx` (already in `stacking-dao.ts`).
- PoX: `useStackingStatusSnap` (unchanged).

## 4. Data Flow

1. **Earn page mount:** `EarnPageContent` mounts `StackingTracker` (unified),
   `IdleStxNudge`, `YieldOpportunities` — each uses existing snapshot/SWR hooks.
2. **Unified position:** `StackingTracker` reads stSTX balance + rate + PoX status →
   `summarizeStackingPosition` → render. "Active" if either form is non-zero.
3. **Assets summary:** `EarnSummaryCard` reads the same inputs → same helper → headline
   number + `/earn` link.
4. **Stake:** unchanged from v1 — `StakeStxModal` from the `YieldOpportunities` row.
5. **Unstake:** disabled "coming soon" affordance (deferred slice).

## 5. Error / Edge Handling

- Wallet not connected → existing connect prompts (per component, unchanged).
- stSTX rate fetch fails → hide the liquid STX-equivalent value, still show stSTX
  balance and PoX section; never block the page.
- No stSTX and no PoX lock → `StackingTracker` shows the existing "Not Stacking" state;
  `EarnSummaryCard` shows the idle-STX CTA.
- Deep links / old `/assets` bookmarks → `/assets` still renders (summary card present),
  no dead routes.

## 6. Testing

- **Unit (TDD, colocated):** `summarizeStackingPosition` — liquid-only, PoX-only, both,
  neither, null rate. Pure function in `domain/stacking/position.ts`.
- **Component:** `StackingTracker` unified states (liquid-only shows Active; PoX-only
  shows Active; neither shows Not Stacking; null rate hides liquid value).
- **E2E:** `e2e/earn-stake.spec.ts` currently drives the stake action **on `/assets`**
  (commit `faad07e`). It MUST be updated to navigate to `/earn` (the components moved),
  and extended with a smoke check that `/earn` is reachable from the sidebar nav. Keep
  the existing mocked-wallet fixture. Verify both desktop and mobile profiles.
- **i18n:** `nav.earn` + any new Earn-page / summary-card keys present in all four
  locales (en, ja, vi, zh); existing parity test stays green.

## 7. Build Approach

Smallest reasonable, independently-verifiable steps with incremental commits (per the
project's commit-cadence preference — each commit green):

1. `summarizeStackingPosition` pure helper + tests (TDD, RED→GREEN).
2. i18n `nav.earn` (+ any Earn-page keys) across en/ja/vi/zh.
3. `/earn` route shell: `page.tsx`, `EarnPageWrapper`, `EarnPageContent` (empty shell
   wired to nav, no moved components yet) → build passes, route reachable.
4. Add `/earn` to `Sidebar.tsx`, `BottomNav.tsx`, `CommandPalette.tsx`.
5. Move `StackingTracker`/`YieldOpportunities`/`StakeStxModal`/`IdleStxNudge` to
   `src/components/earn/`; update imports; mount in `EarnPageContent`.
6. Unify `StackingTracker` (consume the helper; liquid + PoX sections; disabled Unstake).
7. Remove the moved components from `AssetsPageContent`; add `EarnSummaryCard`.
8. Update `e2e/earn-stake.spec.ts` to target `/earn` + nav smoke.
9. `npm run lint` + `npm run build` + `npm run test:e2e` green.
