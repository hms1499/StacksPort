# Unverified Contracts — Design Spec

**Date:** 2026-05-20
**Feature:** Security-aware Unknown Contracts section on Connected Apps tab
**Status:** Approved

## Goal

Help users understand that contracts in the "Unknown Contracts" section are unrecognized and potentially risky. Surface transparency signals (open source source code) fetched from the Hiro API so users can make informed decisions.

## Scope

- Rename section "Unknown Contracts" → "Unverified Contracts"
- Add permanent "Unverified" badge (amber) to every row with tooltip
- Fetch contract source code status from Hiro API per row
- Show "Open Source" badge (green) if source code is published on-chain
- Parse human-readable contract name from contractId (no API needed)
- Loading skeleton while fetching; silent fallback to static on error

**Not in scope:** contract audit status, TVL, deployer reputation scoring, age-based risk levels.

## Architecture

Each `UnknownContractRow` owns its own `useContractInfo(contractId)` SWR call — consistent with the `useTokenMetadata` pattern in the codebase. Failures are isolated per row. `AppsPageContent` only changes the section header label.

## Data Layer

### `fetchContractInfo` — `src/lib/stacks.ts`

```typescript
export async function fetchContractInfo(
  contractId: string
): Promise<{ sourceVerified: boolean }> {
  const res = await fetch(
    `${HIRO_API_BASE}/extended/v1/contract/${contractId}`,
    { signal: AbortSignal.timeout(8_000) }
  );
  if (!res.ok) throw new Error("Failed to fetch contract info");
  const json = await res.json();
  return { sourceVerified: json.source_code != null };
}
```

`source_code` is `null` when contract source is not published on-chain; non-null when it is. This is the primary transparency signal.

### `useContractInfo` hook — `src/hooks/useMarketData.ts`

```typescript
export function useContractInfo(contractId: string | undefined) {
  return useSWR(
    contractId ? ["contract-info", contractId] : null,
    () => fetchContractInfo(contractId!),
    { dedupingInterval: 300_000 }
  );
}
```

No `refreshInterval` — contract source code is immutable once deployed.

## Component: `UnknownContractRow`

**File:** `src/components/apps/UnknownContractRow.tsx` (modify)

### Contract name parsing

```typescript
const contractName = contractId.split(".")[1] ?? contractId;
const deployer = contractId.split(".")[0];
const truncatedDeployer = `${deployer.slice(0, 6)}...${deployer.slice(-4)}`;
```

### Badges

| Badge | Color | Condition | Tooltip |
|---|---|---|---|
| `Unverified` | amber bg + text | always | "Contract not recognized as a known DeFi protocol" |
| `Open Source` | `var(--accent-dim)` + `var(--accent)` | `sourceVerified === true` | — |

Amber values: `backgroundColor: "rgba(245,158,11,0.15)"`, `color: "#d97706"`

### Layout

```
┌─────────────────────────────────────────────────────┐
│ [Code2]  some-contract-name    [Unverified]          │
│          SP2C2...78  ·  3 days ago    [Open Source]  │
│                                           [Explorer →]│
└─────────────────────────────────────────────────────┘
```

- Line 1: contract name (parsed, not monospace) + `Unverified` badge
- Line 2: truncated deployer · timeAgo + `Open Source` badge if applicable
- Line 2 loading: skeleton `animate-pulse` while `useContractInfo` is fetching
- Line 2 error: show deployer + timeAgo only (no `Open Source` badge — same as `sourceVerified === false`)
- Explorer link stays top-right

## `AppsPageContent` changes

**File:** `src/components/apps/AppsPageContent.tsx` (modify)

Change section header only:
```
"Unknown Contracts" → "Unverified Contracts"
```

One occurrence — in the else branch (has data path). The isEmpty branch uses "Explore DeFi on Stacks" and is unchanged.

## File Map

| File | Action |
|---|---|
| `src/lib/stacks.ts` | Add `fetchContractInfo` |
| `src/hooks/useMarketData.ts` | Add `useContractInfo` hook |
| `src/components/apps/UnknownContractRow.tsx` | Full redesign |
| `src/components/apps/AppsPageContent.tsx` | Rename section header |

## Error Handling

- `fetchContractInfo` throws on non-200 → SWR sets `error`
- Row checks `isLoading` for skeleton, then falls back to static layout on error
- No global error surface — each row fails independently
