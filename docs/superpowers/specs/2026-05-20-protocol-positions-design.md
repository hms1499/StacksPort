# Protocol Positions — Design Spec

**Date:** 2026-05-20
**Feature:** Value at Stake per Protocol (Connected Apps tab)
**Status:** Approved

## Goal

Show users how much money they have locked in each DeFi protocol they've interacted with — displayed as token amount + USD value on the Connected Apps tab.

## Scope

**Supported (show position data):**
- StackingDAO (Liquid Staking)
- Lisa (Liquid Staking)
- Zest Protocol (Lending)
- Arkadiko (CDP)

**Not in scope (DEX — LP calculation too complex):**
- Bitflow, ALEX, Velar — cards render as-is, no value row

## Architecture

### Option chosen: Standalone hook + fetcher library

`getConnectedApps` stays focused on tx history only. A new `fetchAllPositions` function handles all position reads. `ProtocolCard` remains a dumb component receiving props.

## Data Layer

**File:** `src/lib/protocol-positions.ts` (new)

```typescript
interface PositionLine {
  label: string;       // "Supplied" | "Borrowed" | "Staked" | "Collateral" | "Debt"
  tokenAmount: string; // formatted, e.g. "500 stSTX"
  usdValue: number;
}

interface ProtocolPosition {
  lines: PositionLine[];
  totalUsd: number;    // net value (supplied - borrowed, collateral - debt)
}

async function fetchAllPositions(
  address: string,
  protocols: KnownProtocol[]
): Promise<Map<string, ProtocolPosition | null>>
```

`Promise.allSettled` — a failed call for one protocol returns `null` without blocking others.

### Position data per protocol

| Protocol | Lines | USD source |
|---|---|---|
| StackingDAO | Staked: X stSTX | STX price × stSTX/STX ratio |
| Lisa | Staked: X LiSTX | STX price × LiSTX/STX ratio |
| Zest | Supplied: $X / Borrowed: $Y | Token price via CoinGecko |
| Arkadiko | Collateral: X STX / Debt: X USDA | STX price |

> Contract IDs and read-only function names must be verified against Hiro API before implementation — never guessed.

## Hook Layer

**Added to:** `src/hooks/useMarketData.ts`

```typescript
export function useProtocolPositions(
  address: string | undefined,
  protocols: KnownProtocol[]
): SWRResponse<Map<string, ProtocolPosition | null>>
```

- SWR key: `["protocol-positions", address]`
- `refreshInterval: 120_000` — positions change less frequently than prices
- `dedupingInterval: 60_000`
- Runs in parallel with `useConnectedApps` — page does not block on positions

## UI Layer

### ProtocolCard

New optional prop: `position?: ProtocolPosition | null | "loading"`

| Prop value | Renders |
|---|---|
| `"loading"` | 2-line animated skeleton in value row |
| `null` | Each line shows `—` with `title="Unable to fetch position"` |
| `ProtocolPosition` | Lines with token amount + USD, total at bottom |
| `undefined` (DEX) | No value row — card unchanged |

Card layout with position data:
```
┌─────────────────────────────────────────┐
│ [logo]  Zest Protocol      [Lending]    │
│                                         │
│  Supplied   500 USDA       $500.00      │
│  Borrowed   100 USDA       $100.00      │
│             Total net      $400.00      │
│                                         │
│  Last used 3 days ago      [Open →]     │
└─────────────────────────────────────────┘
```

### AppsPageContent changes

- Add `useProtocolPositions(address, knownProtocols)` call
- Pass `position` to each `ProtocolCard`:
  - positions loading → `"loading"`
  - protocol not supported (DEX) → omit prop
  - supported → `positionsMap.get(protocol.name) ?? null`

## Commit Plan

Each commit independently green:

1. `feat(apps): add ProtocolPosition types and fetchAllPositions stub`
2. `feat(apps): add StackingDAO position fetcher`
3. `feat(apps): add Lisa position fetcher`
4. `feat(apps): add Zest position fetcher`
5. `feat(apps): add Arkadiko position fetcher`
6. `feat(apps): wire fetchAllPositions with Promise.allSettled`
7. `feat(apps): add useProtocolPositions hook`
8. `feat(apps): add position value row to ProtocolCard`
9. `feat(apps): connect positions in AppsPageContent`

## Error Handling

- Per-protocol failures are silent at the call level (`Promise.allSettled`)
- Failed protocol → `null` in map → card shows `—` with tooltip
- No global error state for positions — protocol list still renders normally
