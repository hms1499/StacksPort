# Connected Apps — Design Spec

**Date:** 2026-04-29  
**Status:** Approved  

## Overview

A new page (`/apps`) that shows users which DeFi protocols and contracts they have interacted with on the Stacks blockchain. Two sections: known protocols (curated, with logo/name/link) and unknown contracts (generic, linked to Stacks Explorer).

This is a read-only feature — no on-chain transactions. Active positions link out to the protocol's own website.

---

## Scope & Constraints

- Scans the **50 most recent transactions** (contract_call type only)
- Known protocols: Bitflow, ALEX, Arkadiko, Zest, StackingDAO, Velar, Lisa
- Unknown contracts: still shown, labelled generically, linked to explorer
- No on-chain exit/revoke transactions in this version
- Wallet address sourced from Zustand `walletStore` (client-side only)

---

## Architecture

### Approach

Pure client-side — consistent with existing codebase patterns (SWR + lib functions + client components). Hiro API is public so no backend proxy needed.

### Data Flow

```
walletStore.stxAddress
        ↓
useConnectedApps(address)   ← SWR hook (5 min refresh)
        ↓
getConnectedApps(address)   ← new function in stacks.ts
        ↓
Hiro API /extended/v2/addresses/{address}/transactions?limit=50
        ↓
filter tx_type === "contract_call"
        ↓
extract unique contract_call.contract_id
        ↓
match against PROTOCOL_REGISTRY
        ↓
{ knownProtocols[], unknownContracts[] }
```

---

## Data Layer

### `PROTOCOL_REGISTRY` (static map in `stacks.ts`)

Maps `contractId → { name, logoUrl, url, category }`.

`logoUrl` uses external URLs from each protocol's public CDN or official website. No local assets needed.

| Protocol    | Category       |
|-------------|----------------|
| Bitflow      | DEX            |
| ALEX         | DEX / Lending  |
| Arkadiko     | CDP            |
| Zest         | Lending        |
| StackingDAO  | Liquid Staking |
| Velar        | DEX            |
| Lisa         | Liquid Staking |

### `getConnectedApps(address: string)`

New export in `src/lib/stacks.ts`.

Returns:
```ts
interface ConnectedAppsResult {
  knownProtocols: KnownProtocol[];
  unknownContracts: UnknownContract[];
}

interface KnownProtocol {
  contractId: string;
  name: string;
  logoUrl: string;
  url: string;
  category: string;
  lastInteractedAt: number; // unix timestamp
}

interface UnknownContract {
  contractId: string;
  lastInteractedAt: number;
}
```

### `useConnectedApps(address)` hook

Added to `src/hooks/useMarketData.ts`. SWR key: `["connected-apps", address]`, `refreshInterval: 300_000` (5 min), `dedupingInterval: 60_000`.

---

## Components & Page

### New files

| File | Purpose |
|------|---------|
| `src/app/apps/page.tsx` | Page — client component, reads wallet from Zustand |
| `src/components/apps/ProtocolCard.tsx` | Card for a known protocol |
| `src/components/apps/UnknownContractRow.tsx` | Row for an unknown contract |

### Page layout (`/apps/page.tsx`)

1. **Header** — title "Connected Apps", subtitle explaining what the page shows
2. **Block 1 — Known Protocols** — responsive grid of `ProtocolCard`
3. **Block 2 — Unknown Contracts** — compact list of `UnknownContractRow` (only shown if any exist)

### `ProtocolCard`

Displays:
- Protocol logo (img) + name
- Category badge
- "Last used" relative timestamp
- "Open" button → external link to protocol website

### `UnknownContractRow`

Displays:
- Generic contract icon + truncated contract address (`SP...xxxx`)
- "Last used" relative timestamp
- Link icon → opens Stacks Explorer for that contract

### States

| State | UI |
|-------|----|
| Loading | Skeleton cards (same count as grid columns) |
| Wallet not connected | Empty state: "Connect your wallet to see app history" |
| No interactions found | Empty state: "No protocol interactions found in your recent transactions" |
| Fetch error | Inline error message with retry |

---

## Navigation

Add to `Sidebar.tsx` and `BottomNav.tsx`:

```ts
{ href: "/apps", label: "Connected Apps", icon: Globe }
```

Icon: `Globe` from `lucide-react`.

---

## Out of Scope (this version)

- On-chain exit/revoke transactions
- Pagination beyond 50 transactions
- Active position balances (would require per-protocol contract reads)
- Filtering or searching the list
