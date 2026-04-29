# Connected Apps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/apps` page that shows which Stacks DeFi protocols and contracts a user has interacted with (based on last 50 transactions), with known protocols shown as cards with links to their websites and unknown contracts listed with Stacks Explorer links.

**Architecture:** Pure client-side using the existing SWR + lib + Zustand pattern. A new `getConnectedApps()` function in `stacks.ts` fetches 50 transactions from Hiro API, filters `contract_call` types, matches deployer addresses against a static `PROTOCOL_REGISTRY`, and returns two lists: known protocols and unknown contracts.

**Tech Stack:** Next.js 15 App Router, SWR, Zustand, Tailwind CSS, Framer Motion, lucide-react, Hiro API (public, no key needed)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/stacks.ts` | Add `PROTOCOL_REGISTRY`, types, `getConnectedApps()` |
| Modify | `src/lib/utils.ts` | Add `timeAgo()` and `truncateContractId()` helpers |
| Modify | `src/hooks/useMarketData.ts` | Add `useConnectedApps()` SWR hook |
| Create | `src/components/apps/ProtocolCard.tsx` | Card UI for a known protocol |
| Create | `src/components/apps/UnknownContractRow.tsx` | Row UI for an unknown contract |
| Create | `src/components/apps/AppsPageWrapper.tsx` | Dynamic import wrapper (avoids SSR issues) |
| Create | `src/components/apps/AppsPageContent.tsx` | Main page logic + all states |
| Create | `src/app/apps/page.tsx` | Next.js route entry point |
| Modify | `src/components/layout/Sidebar.tsx` | Add `/apps` nav item |
| Modify | `src/components/layout/BottomNav.tsx` | Add `/apps` nav item |

---

## Task 1: Add shared time/contract helpers to `utils.ts`

**Files:**
- Modify: `src/lib/utils.ts`

- [ ] **Step 1: Add `timeAgo` and `truncateContractId` to `utils.ts`**

Append to the bottom of `src/lib/utils.ts`:

```ts
export function timeAgo(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function truncateContractId(contractId: string): string {
  const [principal, name] = contractId.split(".");
  if (!name) return contractId;
  const short = `${principal.slice(0, 8)}...${principal.slice(-4)}`;
  return `${short}.${name}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat(apps): add timeAgo and truncateContractId utils"
```

---

## Task 2: Add `PROTOCOL_REGISTRY`, types, and `getConnectedApps` to `stacks.ts`

**Files:**
- Modify: `src/lib/stacks.ts`

- [ ] **Step 1: Add the protocol registry and types**

Append the following block to `src/lib/stacks.ts` (after the existing `getTransactions` function, before the sBTC section):

```ts
// ─── Connected Apps ───────────────────────────────────────────────────────────

interface ProtocolInfo {
  name: string;
  logoUrl: string;
  url: string;
  category: string;
}

// Keys are deployer principal addresses (the part before "." in a contract ID).
// Any contract deployed by that principal is attributed to that protocol.
// Verify/update addresses at https://explorer.hiro.so before shipping.
const PROTOCOL_REGISTRY: Record<string, ProtocolInfo> = {
  "SP20X3DC5R091J8B6YPQT638J8NR1W83KN6TN5BJY": {
    name: "Bitflow",
    logoUrl: "https://bitflow.finance/favicon.ico",
    url: "https://bitflow.finance",
    category: "DEX",
  },
  "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM": {
    name: "ALEX",
    logoUrl: "https://alexgo.io/favicon.ico",
    url: "https://app.alexgo.io",
    category: "DEX / Lending",
  },
  "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR": {
    name: "Arkadiko",
    logoUrl: "https://arkadiko.finance/favicon.ico",
    url: "https://app.arkadiko.finance",
    category: "CDP",
  },
  "SP1NQBQ82XF7BRFM5DNZ62NRQPJGDPK9ZC3Q9S07J": {
    name: "Zest Protocol",
    logoUrl: "https://www.zestprotocol.com/favicon.ico",
    url: "https://www.zestprotocol.com",
    category: "Lending",
  },
  "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG": {
    name: "StackingDAO",
    logoUrl: "https://stackingdao.com/favicon.ico",
    url: "https://stackingdao.com",
    category: "Liquid Staking",
  },
  "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1": {
    name: "Velar",
    logoUrl: "https://www.velar.co/favicon.ico",
    url: "https://app.velar.co",
    category: "DEX",
  },
  "SM3KNVZS30WM7F89SXKVVFY4SN9RMPZZ9FX929DZT": {
    name: "Lisa",
    logoUrl: "https://lisa.finance/favicon.ico",
    url: "https://lisa.finance",
    category: "Liquid Staking",
  },
};

export interface KnownProtocol {
  contractId: string;
  name: string;
  logoUrl: string;
  url: string;
  category: string;
  lastInteractedAt: number;
}

export interface UnknownContract {
  contractId: string;
  lastInteractedAt: number;
}

export interface ConnectedAppsResult {
  knownProtocols: KnownProtocol[];
  unknownContracts: UnknownContract[];
}

export async function getConnectedApps(address: string): Promise<ConnectedAppsResult> {
  const data = await getTransactions(address, 50);
  const txs = (data.results ?? []) as Record<string, unknown>[];

  // Map contractId → most recent block_time for deduplication
  const seenContracts = new Map<string, number>();

  for (const tx of txs) {
    if (tx.tx_type !== "contract_call") continue;
    const contractCall = tx.contract_call as Record<string, unknown> | undefined;
    const contractId = contractCall?.contract_id as string | undefined;
    if (!contractId) continue;
    const blockTime = (tx.block_time as number) ?? 0;
    const existing = seenContracts.get(contractId);
    if (existing === undefined || blockTime > existing) {
      seenContracts.set(contractId, blockTime);
    }
  }

  const knownProtocols: KnownProtocol[] = [];
  const unknownContracts: UnknownContract[] = [];
  const seenDeployers = new Set<string>();

  for (const [contractId, lastInteractedAt] of seenContracts) {
    const deployer = contractId.split(".")[0];
    const info = PROTOCOL_REGISTRY[deployer];
    if (info) {
      // One card per protocol deployer even if multiple contracts matched
      if (!seenDeployers.has(deployer)) {
        seenDeployers.add(deployer);
        knownProtocols.push({ contractId, ...info, lastInteractedAt });
      }
    } else {
      unknownContracts.push({ contractId, lastInteractedAt });
    }
  }

  return { knownProtocols, unknownContracts };
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors related to the new code.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stacks.ts
git commit -m "feat(apps): add PROTOCOL_REGISTRY and getConnectedApps to stacks.ts"
```

---

## Task 3: Add `useConnectedApps` SWR hook

**Files:**
- Modify: `src/hooks/useMarketData.ts`

- [ ] **Step 1: Add import for new types**

In `src/hooks/useMarketData.ts`, add `getConnectedApps`, `ConnectedAppsResult` to the existing import from `@/lib/stacks`:

```ts
import {
  getPortfolioValue,
  getPortfolioHistory,
  getSTXPriceHistory,
  getTrendingTokens,
  getSTXMarketStats,
  getSTXMarketHistory,
  getTransactions,
  getFungibleTokens,
  getTokenMetadata,
  getConnectedApps,
  type PortfolioValue,
  type TrendingToken,
  type STXMarketStats,
  type STXMarketHistory,
  type ConnectedAppsResult,
} from "@/lib/stacks";
```

- [ ] **Step 2: Add the hook at the bottom of `useMarketData.ts`**

Append before the final `export type` line:

```ts
export function useConnectedApps(address: string | undefined) {
  return useSWR<ConnectedAppsResult>(
    address ? ["connected-apps", address] : null,
    () => getConnectedApps(address!),
    { refreshInterval: 300_000, dedupingInterval: 60_000 }
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMarketData.ts
git commit -m "feat(apps): add useConnectedApps SWR hook"
```

---

## Task 4: Create `ProtocolCard` component

**Files:**
- Create: `src/components/apps/ProtocolCard.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { ExternalLink } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface ProtocolCardProps {
  name: string;
  logoUrl: string;
  url: string;
  category: string;
  lastInteractedAt: number;
}

export default function ProtocolCard({
  name,
  logoUrl,
  url,
  category,
  lastInteractedAt,
}: ProtocolCardProps) {
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
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Last used {lastInteractedAt > 0 ? timeAgo(lastInteractedAt) : "—"}
        </p>
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
          Open <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/apps/ProtocolCard.tsx
git commit -m "feat(apps): add ProtocolCard component"
```

---

## Task 5: Create `UnknownContractRow` component

**Files:**
- Create: `src/components/apps/UnknownContractRow.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { Code2, ExternalLink } from "lucide-react";
import { timeAgo, truncateContractId } from "@/lib/utils";

interface UnknownContractRowProps {
  contractId: string;
  lastInteractedAt: number;
}

export default function UnknownContractRow({
  contractId,
  lastInteractedAt,
}: UnknownContractRowProps) {
  const explorerUrl = `https://explorer.hiro.so/address/${contractId}?chain=mainnet`;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <Code2 size={15} style={{ color: "var(--text-muted)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-mono truncate"
          style={{ color: "var(--text-secondary)" }}
        >
          {truncateContractId(contractId)}
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {lastInteractedAt > 0 ? timeAgo(lastInteractedAt) : "—"}
        </p>
      </div>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 transition-opacity hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
        title="View on Stacks Explorer"
      >
        <ExternalLink size={15} />
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/apps/UnknownContractRow.tsx
git commit -m "feat(apps): add UnknownContractRow component"
```

---

## Task 6: Create page files

**Files:**
- Create: `src/app/apps/page.tsx`
- Create: `src/components/apps/AppsPageWrapper.tsx`
- Create: `src/components/apps/AppsPageContent.tsx`

- [ ] **Step 1: Create `src/app/apps/page.tsx`**

```tsx
import AppsPageWrapper from "@/components/apps/AppsPageWrapper";

export default function AppsPage() {
  return <AppsPageWrapper />;
}
```

- [ ] **Step 2: Create `src/components/apps/AppsPageWrapper.tsx`**

```tsx
"use client";

import dynamic from "next/dynamic";

const AppsPageContent = dynamic(
  () => import("@/components/apps/AppsPageContent"),
  { ssr: false }
);

export default function AppsPageWrapper() {
  return <AppsPageContent />;
}
```

- [ ] **Step 3: Create `src/components/apps/AppsPageContent.tsx`**

```tsx
"use client";

import { Globe } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useConnectedApps } from "@/hooks/useMarketData";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import ProtocolCard from "@/components/apps/ProtocolCard";
import UnknownContractRow from "@/components/apps/UnknownContractRow";

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 h-28 animate-pulse"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    />
  );
}

export default function AppsPageContent() {
  const { stxAddress, isConnected } = useWalletStore();
  const { data, isLoading, error, mutate } = useConnectedApps(
    stxAddress ?? undefined
  );

  const isEmpty =
    !data ||
    (data.knownProtocols.length === 0 && data.unknownContracts.length === 0);

  return (
    <>
      <Topbar title="Connected Apps" />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          DeFi protocols and contracts you have interacted with on Stacks,
          based on your 50 most recent transactions.
        </p>

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Globe size={40} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Connect your wallet to see your app history
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Failed to load app history.
            </p>
            <button
              onClick={() => mutate()}
              className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--accent-dim)",
                color: "var(--accent)",
              }}
            >
              Retry
            </button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Globe size={40} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No protocol interactions found in your recent transactions
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {data.knownProtocols.length > 0 && (
              <section>
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Known Protocols
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.knownProtocols.map((p) => (
                    <ProtocolCard key={p.contractId} {...p} />
                  ))}
                </div>
              </section>
            )}
            {data.unknownContracts.length > 0 && (
              <section>
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Unknown Contracts
                </h2>
                <div className="space-y-2">
                  {data.unknownContracts.map((c) => (
                    <UnknownContractRow key={c.contractId} {...c} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </AnimatedPage>
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/apps/page.tsx src/components/apps/AppsPageWrapper.tsx src/components/apps/AppsPageContent.tsx
git commit -m "feat(apps): add Connected Apps page"
```

---

## Task 7: Add navigation entries

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Update `Sidebar.tsx`**

Add `Globe` to the lucide-react import line:

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
} from "lucide-react";
```

Add the new nav item to the `navItems` array (after the `/ai` entry):

```ts
const navItems = [
  { href: "/dashboard",     label: "Dashboard",      icon: LayoutDashboard },
  { href: "/assets",        label: "My Assets",      icon: Wallet },
  { href: "/trade",         label: "Swap",            icon: ArrowLeftRight },
  { href: "/dca",           label: "DCA Vault",       icon: Repeat2 },
  { href: "/notifications", label: "Alerts",          icon: Bell },
  { href: "/ai",            label: "Stacks AI",       icon: Sparkles },
  { href: "/apps",          label: "Connected Apps",  icon: Globe },
];
```

- [ ] **Step 2: Update `BottomNav.tsx`**

Add `Globe` to the lucide-react import line:

```ts
import { LayoutDashboard, Wallet, ArrowLeftRight, Bell, Repeat2, Sparkles, Globe } from "lucide-react";
```

Add the new nav item to the `navItems` array (after the `/ai` entry):

```ts
const navItems = [
  { href: "/dashboard",     label: "Home",   icon: LayoutDashboard },
  { href: "/assets",        label: "Assets", icon: Wallet },
  { href: "/trade",         label: "Swap",   icon: ArrowLeftRight },
  { href: "/dca",           label: "DCA",    icon: Repeat2 },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/ai",            label: "AI",     icon: Sparkles },
  { href: "/apps",          label: "Apps",   icon: Globe },
];
```

- [ ] **Step 3: Start dev server and verify the full feature**

```bash
npm run dev
```

Open `http://localhost:3000/apps` and check:
1. Sidebar shows "Connected Apps" with Globe icon
2. BottomNav shows "Apps" on mobile viewport
3. Without wallet connected → empty state with Globe icon + connect prompt
4. After connecting wallet → loading skeletons appear, then protocol cards or empty state
5. Known protocols show logo, category badge, "Last used X ago", and "Open" button linking to their site
6. Unknown contracts show truncated address and Explorer link
7. Error state: disconnect network in DevTools → retry button appears

- [ ] **Step 4: Kill dev server**

```bash
kill $(lsof -ti:3000)
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/BottomNav.tsx
git commit -m "feat(apps): add Connected Apps to sidebar and bottom nav"
```
