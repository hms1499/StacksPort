# Explore DeFi Empty State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty state on the Connected Apps tab with an "Explore DeFi on Stacks" grid showing all 7 Stacks DeFi protocols with a short tagline.

**Architecture:** New `ExploreProtocolCard` component co-located with its static data array `EXPLORE_PROTOCOLS`. `AppsPageContent` replaces its `isEmpty` branch to render the explore grid. No new hooks, no API calls.

**Tech Stack:** React, TypeScript, Tailwind CSS, CSS variables (`var(--...)`), Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/apps/ExploreProtocolCard.tsx` | **Create** | Component + static `EXPLORE_PROTOCOLS` array |
| `src/lib/explore-protocols.test.ts` | **Create** | Unit tests for `EXPLORE_PROTOCOLS` data shape |
| `src/components/apps/AppsPageContent.tsx` | **Modify** | Replace isEmpty branch, add import |

---

## Task 1: `ExploreProtocolCard` component + data + tests

**Files:**
- Create: `src/components/apps/ExploreProtocolCard.tsx`
- Create: `src/lib/explore-protocols.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/explore-protocols.test.ts
import { describe, it, expect } from "vitest";
import { EXPLORE_PROTOCOLS } from "@/components/apps/ExploreProtocolCard";

describe("EXPLORE_PROTOCOLS", () => {
  it("has 7 entries", () => {
    expect(EXPLORE_PROTOCOLS).toHaveLength(7);
  });

  it("every entry has required fields with valid values", () => {
    for (const p of EXPLORE_PROTOCOLS) {
      expect(p.name).toBeTruthy();
      expect(p.logoUrl).toMatch(/^https?:\/\//);
      expect(p.url).toMatch(/^https?:\/\//);
      expect(p.category).toBeTruthy();
      expect(p.tagline).toBeTruthy();
    }
  });

  it("includes all 7 expected protocols", () => {
    const names = EXPLORE_PROTOCOLS.map((p) => p.name);
    expect(names).toContain("StackingDAO");
    expect(names).toContain("Lisa");
    expect(names).toContain("Zest Protocol");
    expect(names).toContain("Arkadiko");
    expect(names).toContain("Bitflow");
    expect(names).toContain("ALEX");
    expect(names).toContain("Velar");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (file doesn't exist yet)**

```bash
npm test -- explore-protocols
```

Expected: FAIL with "Cannot find module '@/components/apps/ExploreProtocolCard'"

- [ ] **Step 3: Create the component file**

```typescript
// src/components/apps/ExploreProtocolCard.tsx
"use client";

import { ExternalLink } from "lucide-react";

interface ExploreProtocolCardProps {
  name: string;
  logoUrl: string;
  url: string;
  category: string;
  tagline: string;
}

export const EXPLORE_PROTOCOLS: ExploreProtocolCardProps[] = [
  {
    name: "StackingDAO",
    logoUrl: "https://stackingdao.com/favicon.ico",
    url: "https://stackingdao.com",
    category: "Liquid Staking",
    tagline: "Stake STX and receive stSTX, a liquid token earning stacking rewards",
  },
  {
    name: "Lisa",
    logoUrl: "https://lisa.finance/favicon.ico",
    url: "https://lisa.finance",
    category: "Liquid Staking",
    tagline: "Stake STX and receive LiSTX while keeping liquidity",
  },
  {
    name: "Zest Protocol",
    logoUrl: "https://www.zestprotocol.com/favicon.ico",
    url: "https://www.zestprotocol.com",
    category: "Lending",
    tagline: "Supply assets to earn yield or borrow against your crypto",
  },
  {
    name: "Arkadiko",
    logoUrl: "https://arkadiko.finance/favicon.ico",
    url: "https://app.arkadiko.finance",
    category: "CDP",
    tagline: "Mint USDA stablecoin by locking STX as collateral",
  },
  {
    name: "Bitflow",
    logoUrl: "https://bitflow.finance/favicon.ico",
    url: "https://bitflow.finance",
    category: "DEX",
    tagline: "Swap tokens on Stacks with low fees",
  },
  {
    name: "ALEX",
    logoUrl: "https://alexgo.io/favicon.ico",
    url: "https://app.alexgo.io",
    category: "DEX / Lending",
    tagline: "Trade, lend, and borrow across Stacks DeFi",
  },
  {
    name: "Velar",
    logoUrl: "https://www.velar.co/favicon.ico",
    url: "https://app.velar.co",
    category: "DEX",
    tagline: "Swap and provide liquidity on Stacks",
  },
];

export default function ExploreProtocolCard({
  name,
  logoUrl,
  url,
  category,
  tagline,
}: ExploreProtocolCardProps) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-3">
        <img
          src={logoUrl}
          alt={name}
          width={32}
          height={32}
          className="w-8 h-8 rounded-lg object-cover shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-sm truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {name}
          </p>
          <span
            className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5"
            style={{
              backgroundColor: "var(--accent-dim)",
              color: "var(--accent)",
            }}
          >
            {category}
          </span>
        </div>
      </div>
      <p className="text-xs line-clamp-2" style={{ color: "var(--text-muted)" }}>
        {tagline}
      </p>
      <div className="flex justify-end">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "var(--accent-dim)",
            color: "var(--accent)",
          }}
        >
          Try it <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- explore-protocols
```

Expected: 3 tests pass

- [ ] **Step 5: Run build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/apps/ExploreProtocolCard.tsx src/lib/explore-protocols.test.ts
git commit -m "feat(apps): add ExploreProtocolCard component with static protocol data"
```

---

## Task 2: Wire into `AppsPageContent`

**Files:**
- Modify: `src/components/apps/AppsPageContent.tsx`

The current `isEmpty` branch (lines 76–82) renders a centered Globe icon + text. Replace it with the explore grid. `Globe` import stays — it's still used in the `!isConnected` branch (line 49).

- [ ] **Step 1: Add import at the top of `AppsPageContent.tsx`**

After the existing imports, add:

```typescript
import ExploreProtocolCard, { EXPLORE_PROTOCOLS } from "@/components/apps/ExploreProtocolCard";
```

The full import block becomes:

```typescript
import { Globe } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useConnectedApps, useProtocolPositions } from "@/hooks/useMarketData";
import { SUPPORTED_PROTOCOLS } from "@/lib/protocol-positions";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import ProtocolCard from "@/components/apps/ProtocolCard";
import UnknownContractRow from "@/components/apps/UnknownContractRow";
import ExploreProtocolCard, { EXPLORE_PROTOCOLS } from "@/components/apps/ExploreProtocolCard";
```

- [ ] **Step 2: Replace the isEmpty branch**

Find this block (lines 76–83):

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

Replace with:

```tsx
) : isEmpty ? (
  <section>
    <h2
      className="text-sm font-semibold mb-3"
      style={{ color: "var(--text-secondary)" }}
    >
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

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
npm test 2>&1 | tail -15
```

Expected: all tests pass (79 tests across 4 files)

- [ ] **Step 5: Commit**

```bash
git add src/components/apps/AppsPageContent.tsx
git commit -m "feat(apps): show Explore DeFi grid for users with no protocol history"
```

---

## Manual Verification

After both tasks, run `npm run dev` and open `http://localhost:3000` with a wallet that has **no** DeFi protocol interactions:

- [ ] Connected Apps tab shows "Explore DeFi on Stacks" header
- [ ] 7 cards in a responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
- [ ] Each card shows logo, name, category badge, tagline, "Try it →" button
- [ ] "Try it →" opens the correct URL in a new tab
- [ ] With a wallet that HAS protocol interactions — existing Known Protocols view unchanged
