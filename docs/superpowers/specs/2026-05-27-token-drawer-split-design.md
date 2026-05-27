# TokenDetailDrawer Split — Design

**Date:** 2026-05-27
**Status:** Approved, awaiting plan
**Type:** Pure mechanical refactor (no behavior change)

## Problem

`src/components/assets/TokenDetailDrawer.tsx` is **1391 LOC** and contains 9 React components plus 8 helper functions in a single file. It is the largest file in `src/components/assets/` (next largest: `TokenHoldings.tsx` at 410 LOC).

This is the blocker for every future drawer-scoped feature in the assets-page polish backlog (price alert button, allowance revoke, per-token CSV export, etc.). Touching anything inside the drawer currently forces editing this monolithic file.

## Goals

1. Split the file into focused units, each with a single responsibility and clear prop interface.
2. **No behavior change.** Rendered output, event handlers, animations, and styles stay byte-identical.
3. Keep import surface stable for callers (only one import site exists today: `TokenHoldings.tsx`).

## Non-Goals

- Adding tabs inside the drawer (UX change — deferred).
- Extracting `QuickSend` / `QuickSwap` into a shared `components/trade/` location for reuse (YAGNI — no second consumer exists yet).
- Adding unit tests for moved code (move-only refactor; verification is build + manual smoke).
- Introducing a `drawer/utils.ts` for shared helpers (premature — see Helper Placement).
- Any UX, style, or logic edits inside the panels themselves.

## Target Structure

```
src/components/assets/
├── TokenDetailDrawer.tsx        # DELETED at end of refactor
└── drawer/
    ├── index.tsx                # Shell: wrapper, header, action bar, panel ordering (~200 LOC)
    ├── PriceChart.tsx           # Was TokenPriceChart (~130 LOC)
    ├── QuickSend.tsx            # Was InlineQuickSend (~240 LOC)
    ├── QuickSwap.tsx            # Was InlineQuickSwap (~190 LOC)
    ├── MarketStats.tsx          # Was TokenMarketStats24h (~50 LOC)
    ├── Transactions.tsx         # Was TokenTransactions + TokenTxRowView (~130 LOC)
    ├── PnL.tsx                  # Was TokenPnL (~100 LOC)
    └── YieldInfo.tsx            # Was TokenYieldInfo + StSTXYieldCard + SBTCYieldCard (~170 LOC)
```

Caller update:

```ts
// Before
import TokenDetailDrawer from "@/components/assets/TokenDetailDrawer";

// After
import TokenDetailDrawer from "@/components/assets/drawer";
```

Next.js / TypeScript resolve `@/components/assets/drawer` to `drawer/index.tsx` automatically. No barrel file needed beyond `index.tsx` being the shell with `export default`.

## Component Boundaries & Props

The shell owns: drawer chrome (overlay, close button, ESC handler), header (token icon, balance, change %), action bar (send/receive/swap/alert buttons), and the vertical stacking order of sub-panels. Each panel is a self-contained widget below.

```ts
// drawer/index.tsx
interface Props {
  token: TokenWithValue | null;
  totalUsd: number;
  onClose: () => void;
  onSend: (t: TokenWithValue) => void;
  onReceive: () => void;
}

// drawer/PriceChart.tsx
interface Props { geckoId: string; symbol: string }

// drawer/MarketStats.tsx
interface Props { geckoId: string }

// drawer/QuickSend.tsx
interface Props { token: TokenWithValue; onDone: () => void }

// drawer/QuickSwap.tsx
interface Props { token: TokenWithValue }

// drawer/Transactions.tsx
interface Props { contractId?: string; symbol: string }

// drawer/PnL.tsx
interface Props { token: TokenWithValue }

// drawer/YieldInfo.tsx
interface Props { token: TokenWithValue }
```

**Design rule:** each panel receives the *narrowest* prop it needs. `PriceChart` and `MarketStats` need only `geckoId` (+ `symbol` for display), not the full `TokenWithValue`. This makes the panels independently testable and lets us swap data sources later without changing internal shape.

## Helper Placement

Each helper lives in the file that uses it. No shared `drawer/utils.ts` is created in this refactor.

| Helper | File |
|---|---|
| `formatBalance`, `formatPrice`, `truncateMiddle`, `ActionButton` | `drawer/index.tsx` |
| `formatCompactUsd` | `drawer/MarketStats.tsx` |
| `timeAgo`, `formatTxAmount` | `drawer/Transactions.tsx` |
| `resolveSwapFrom`, `formatOut` | `drawer/QuickSwap.tsx` |

**Promote rule (for future):** if 2+ panels grow a duplicate helper, extract to `drawer/utils.ts` *then* — not pre-emptively.

## Behavior Guarantees

The following must be preserved exactly:

- Render order of panels inside the drawer.
- `Escape` key handler attaches when a token is selected, detaches on close (current `useEffect` in shell).
- Clipboard copy of `contractId` (or literal `"STX"`).
- Swap action routes to `/trade?from=<encoded>` and closes drawer.
- All Tailwind classes, inline styles, and CSS variables.
- All `framer-motion` / GSAP animation props (if any are inside moved panels).
- All `useEffect` cleanup ordering.

## Verification Strategy

Pure mechanical refactor → verification is observation-based, not test-based:

1. After **each** commit:
   - `npm run build` must succeed.
   - `npm run lint` must succeed.
2. After the **final** commit (manual smoke on `npm run dev`):
   - Open drawer for STX → all panels render, charts load, quick-send + quick-swap interactive.
   - Open drawer for sBTC → sBTC yield card visible, monitor data loads.
   - Open drawer for stSTX → stSTX yield card visible.
   - ESC closes drawer; overlay click closes drawer; close button closes drawer.
   - Copy-contract button copies and shows checkmark.
   - Swap button navigates to `/trade?from=...` and drawer closes.
3. Free port 3000 when done (per user preference).

No new unit tests. Existing test suite (`npm test`) must remain green.

## Commit Plan

Nine commits, each independently buildable and revertable. Aligned with the project's fine-granularity commit cadence.

1. `refactor(drawer): scaffold drawer/ folder with index re-exporting current component`
   — Create `drawer/index.tsx` that re-exports `TokenDetailDrawer` default; update `TokenHoldings.tsx` import to `@/components/assets/drawer`. No code moved yet. Build proves the import path works.
2. `refactor(drawer): extract PriceChart`
3. `refactor(drawer): extract MarketStats`
4. `refactor(drawer): extract Transactions`
5. `refactor(drawer): extract PnL`
6. `refactor(drawer): extract YieldInfo`
7. `refactor(drawer): extract QuickSend`
8. `refactor(drawer): extract QuickSwap`
9. `refactor(drawer): move shell into drawer/index.tsx, delete TokenDetailDrawer.tsx`

After step 9, the original file is removed and `drawer/index.tsx` is the shell.

## Risks

| Risk | Mitigation |
|---|---|
| Hidden coupling between panels via closures over shell-local state | Read each panel's full body before extracting; map every external identifier used. |
| `useEffect` cleanup ordering changes when components are split | Each `useEffect` lives in the component that owns its state; ordering is preserved because React executes effects bottom-up regardless of file location. |
| Import cycles between shell and panels | Panels do not import from `index.tsx`. One-way dependency: shell → panels. |
| Style regression from missing className inheritance | Manual smoke covers visual diff on 3 tokens. |

## Out of Scope (for follow-up rounds)

- Drawer tabs (group panels into Overview / Trade / Activity / Yield).
- Extracting `QuickSend` / `QuickSwap` for reuse outside drawer.
- Adding price-alert button (needs `priceAlertStore` integration design).
- Per-token CSV export (needs separate spec — tax framework decisions).
