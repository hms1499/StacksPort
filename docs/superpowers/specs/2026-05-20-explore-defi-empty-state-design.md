# Explore DeFi Empty State — Design Spec

**Date:** 2026-05-20
**Feature:** Explore DeFi section for new users on Connected Apps tab
**Status:** Approved

## Goal

Replace the empty state on the Connected Apps tab with an "Explore DeFi on Stacks" section that introduces new users to the 7 DeFi protocols available on Stacks, each with a short tagline describing what it does.

## Trigger

Only shown when `isEmpty === true` (user has no known protocol interactions and no unknown contracts in their last 50 transactions). Users with existing data see their normal Connected Apps view unchanged.

## Architecture

**Approach:** New `ExploreProtocolCard` component + static data array co-located in the same file. `AppsPageContent` replaces its `isEmpty` branch with the explore grid. No new API calls, no new hooks, no changes to `ProtocolCard`.

## Data

Static array `EXPLORE_PROTOCOLS` defined in `src/components/apps/ExploreProtocolCard.tsx`:

| Protocol | Category | Tagline |
|---|---|---|
| StackingDAO | Liquid Staking | Stake STX and receive stSTX, a liquid token earning stacking rewards |
| Lisa | Liquid Staking | Stake STX and receive LiSTX while keeping liquidity |
| Zest Protocol | Lending | Supply assets to earn yield or borrow against your crypto |
| Arkadiko | CDP | Mint USDA stablecoin by locking STX as collateral |
| Bitflow | DEX | Swap tokens on Stacks with low fees |
| ALEX | DEX / Lending | Trade, lend, and borrow across Stacks DeFi |
| Velar | DEX | Swap and provide liquidity on Stacks |

## Component

**File:** `src/components/apps/ExploreProtocolCard.tsx` (new)

```typescript
interface ExploreProtocolCardProps {
  name: string;
  logoUrl: string;
  url: string;
  category: string;
  tagline: string;
}
```

Layout:
```
┌─────────────────────────────────────────┐
│ [logo]  StackingDAO      [Liquid Staking]│
│         Stake STX and receive stSTX...  │
│                                [Try it →]│
└─────────────────────────────────────────┘
```

- Same `rounded-xl`, `var(--bg-surface)`, `var(--border-subtle)` as `ProtocolCard`
- Header: logo (32×32, rounded-lg, onError hide) + name (`var(--text-primary)`) + category badge (`var(--accent-dim)` / `var(--accent)`)
- Tagline: `text-xs`, `var(--text-muted)`, `line-clamp-2`
- Footer: "Try it →" button with `ExternalLink` icon, same style as "Open →" in `ProtocolCard`, `target="_blank" rel="noopener noreferrer"`, aligned right
- No "Last used" row

Pure presentational component — no state, no hooks.

## `AppsPageContent` changes

**File:** `src/components/apps/AppsPageContent.tsx` (modify)

Replace the `isEmpty` branch:

**Before:**
```tsx
) : isEmpty ? (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
    <Globe size={40} style={{ color: "var(--text-muted)" }} />
    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
      No protocol interactions found in your recent transactions
    </p>
  </div>
)
```

**After:**
```tsx
) : isEmpty ? (
  <section>
    <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
      Explore DeFi on Stacks
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {EXPLORE_PROTOCOLS.map((p) => (
        <ExploreProtocolCard key={p.name} {...p} />
      ))}
    </div>
  </section>
)
```

Add imports at top:
```typescript
import ExploreProtocolCard, { EXPLORE_PROTOCOLS } from "@/components/apps/ExploreProtocolCard";
```

The `Globe` import can be removed if no longer used elsewhere in the file.

## File Map

| File | Action |
|---|---|
| `src/components/apps/ExploreProtocolCard.tsx` | Create |
| `src/components/apps/AppsPageContent.tsx` | Modify |

## Out of Scope

- No APY/TVL data fetching
- No "Popular" or "New" badges
- No changes to `ProtocolCard`
- No changes to the has-data path in `AppsPageContent`
