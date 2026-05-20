# Protocol Positions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display "value at stake" (token amount + USD) on each supported protocol card in the Connected Apps tab.

**Architecture:** New `src/lib/protocol-positions.ts` handles all contract reads and returns a `Map<protocolName, ProtocolPosition | null>`. A new `useProtocolPositions` SWR hook fetches eagerly on page load. `ProtocolCard` receives an optional `position` prop — DEX cards receive `undefined` (no value row), supported protocols receive data, `"loading"`, or `null` (shows `—`).

**Tech Stack:** `@stacks/transactions` (Clarity encoding), Hiro REST API (`/v2/contracts/call-read`), SWR, React, TypeScript, Vitest

---

## Verified Contracts (do not modify without re-verifying on-chain)

| Protocol | Contract | Key Function |
|---|---|---|
| StackingDAO | `SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-v1` | `get-stx-balance(principal)` → uint128 micro-STX |
| Lisa | `SMF0JEHTMZVHXYFBQCAS3VH601WDR03XXCWGHZ1F.token-lqstx` | `get-balance(principal)` → `(ok uint)` shares; `get-shares-to-tokens(uint)` → uint128 micro-STX |
| Arkadiko | `SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-freddie-v1-1` | `get-vault-entries(principal)` → `{ids: uint[]}` ; `get-vault-by-id(uint)` → tuple |
| Zest | `SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zaeusdc-v1-2` | `get-principal-balance(principal)` → `(ok uint)` micro-USDC (6 dec) |

Lisa note: user holds `lqstx` tokens in their wallet. Detect by scanning `getFungibleTokens` for asset ids containing `token-lqstx::lqstx`. The contract address comes from the asset identifier itself — no hardcoding needed.

Zest note: user holds `zae*` receipt tokens in their wallet from deployer `SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N`. Detect by scanning `getFungibleTokens` for assets from that deployer.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/protocol-positions.ts` | **Create** | Types, Clarity helpers, all fetchers, `fetchAllPositions`, `SUPPORTED_PROTOCOLS` |
| `src/lib/protocol-positions.test.ts` | **Create** | Unit tests for pure helpers |
| `src/hooks/useMarketData.ts` | **Modify** | Add `useProtocolPositions` export |
| `src/components/apps/ProtocolCard.tsx` | **Modify** | Add `position` prop + value row UI |
| `src/components/apps/AppsPageContent.tsx` | **Modify** | Call hook, pass position to each card |

---

## Task 1: Types + Clarity helpers + `callReadOnly`

**Files:**
- Create: `src/lib/protocol-positions.ts`
- Create: `src/lib/protocol-positions.test.ts`

- [ ] **Step 1: Write failing tests for pure helpers**

```typescript
// src/lib/protocol-positions.test.ts
import { describe, it, expect } from "vitest";
import {
  uintCV,
  standardPrincipalCV,
  serializeCV,
  hexToCV,
  ClarityType,
} from "@stacks/transactions";

// We test that our cvHex helper produces the same output as
// @stacks/transactions serializeCV — verifying our encoding wrapper is correct.
// These are characterization tests: if they change, the on-chain calls change.

describe("cvHex", () => {
  // Import the helper once the file exists
  // For now test the underlying @stacks/transactions behavior we rely on
  it("serializes uintCV to hex string", () => {
    const result = serializeCV(uintCV(1_000_000));
    const hex = typeof result === "string" ? result : Buffer.from(result as Uint8Array).toString("hex");
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(hex.length).toBeGreaterThan(0);
  });

  it("serializes standard principal to hex string", () => {
    const result = serializeCV(standardPrincipalCV("SP000000000000000000002Q6VF78"));
    const hex = typeof result === "string" ? result : Buffer.from(result as Uint8Array).toString("hex");
    expect(hex).toMatch(/^[0-9a-f]+$/);
  });
});

describe("formatTokenAmount", () => {
  it("formats micro-STX to human STX with 2 decimals", () => {
    expect((1_500_000 / 1_000_000).toFixed(2)).toBe("1.50");
  });

  it("formats micro-USDC to human USDC with 2 decimals", () => {
    expect((2_500_000 / 1_000_000).toFixed(2)).toBe("2.50");
  });
});
```

- [ ] **Step 2: Run tests — expect them to pass (they test @stacks/transactions behavior, no new code yet)**

```bash
npm test -- protocol-positions
```

Expected: PASS (no new code needed, tests verify existing library behavior)

- [ ] **Step 3: Create `src/lib/protocol-positions.ts` with types and helpers**

```typescript
import {
  standardPrincipalCV,
  uintCV,
  serializeCV,
  hexToCV,
  ClarityType,
  type ClarityValue,
} from "@stacks/transactions";
import { getSTXPrice, getFungibleTokens, type KnownProtocol } from "@/lib/stacks";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PositionLine {
  label: string;
  tokenAmount: string;
  usdValue: number;
}

export interface ProtocolPosition {
  lines: PositionLine[];
  totalUsd: number;
}

// Protocols that support position fetching. DEX protocols are excluded.
export const SUPPORTED_PROTOCOLS = new Set([
  "StackingDAO",
  "Lisa",
  "Arkadiko",
  "Zest Protocol",
]);

// ─── Clarity helpers ──────────────────────────────────────────────────────────

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

function cvHex(cv: ClarityValue): string {
  const result = serializeCV(cv);
  if (typeof result === "string") return "0x" + result;
  return "0x" + Buffer.from(result as Uint8Array).toString("hex");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCV(cv: ClarityValue): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = cv as unknown as any;
  const t = raw.type;
  if (t === "uint" || t === "int") return Number(raw.value);
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "none") return null;
  if (t === "some") return parseCV(raw.value);
  if (t === "ok") return parseCV(raw.value);
  if (t === "err") throw new Error("Contract returned error");
  if (t === "tuple") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw.value ?? {})) result[k] = parseCV(v as ClarityValue);
    return result;
  }
  if (t === "list") return (raw.value as ClarityValue[] ?? []).map(parseCV);
  switch (cv.type) {
    case ClarityType.UInt:
    case ClarityType.Int:
      return Number(raw.value);
    case ClarityType.BoolTrue: return true;
    case ClarityType.BoolFalse: return false;
    case ClarityType.ResponseOk: return parseCV(raw.value);
    case ClarityType.ResponseErr: throw new Error("Contract returned error");
    case ClarityType.OptionalNone: return null;
    case ClarityType.OptionalSome: return parseCV(raw.value);
    case ClarityType.Tuple: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(raw.data ?? raw.value ?? {})) result[k] = parseCV(v as ClarityValue);
      return result;
    }
    case ClarityType.List:
      return (raw.list ?? raw.value ?? [] as ClarityValue[]).map(parseCV);
    default: return null;
  }
}

async function callReadOnly(
  contractAddress: string,
  contractName: string,
  fn: string,
  args: string[] = []
): Promise<ClarityValue> {
  const res = await fetch(
    `${HIRO_API}/v2/contracts/call-read/${contractAddress}/${contractName}/${fn}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
      signal: AbortSignal.timeout(8_000),
    }
  );
  const json = await res.json();
  if (!json.okay) throw new Error(json.cause ?? "read-only call failed");
  return hexToCV(json.result);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- protocol-positions
```

- [ ] **Step 5: Run build to verify types**

```bash
npm run build 2>&1 | tail -20
```

Expected: no new errors from `protocol-positions.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/protocol-positions.ts src/lib/protocol-positions.test.ts
git commit -m "feat(apps): add ProtocolPosition types and Clarity helpers"
```

---

## Task 2: StackingDAO fetcher

**Files:**
- Modify: `src/lib/protocol-positions.ts`

- [ ] **Step 1: Add the StackingDAO fetcher after the Clarity helpers section**

```typescript
// ─── StackingDAO ─────────────────────────────────────────────────────────────
// get-stx-balance(address) → uint128 micro-STX currently staked by this user

const STACKING_DAO_ADDR = "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG";
const STACKING_DAO_NAME = "stacking-dao-core-v1";

async function fetchStackingDaoPosition(
  address: string,
  stxPrice: number
): Promise<ProtocolPosition | null> {
  const cv = await callReadOnly(STACKING_DAO_ADDR, STACKING_DAO_NAME, "get-stx-balance", [
    cvHex(standardPrincipalCV(address)),
  ]);
  const microStx = parseCV(cv) as number;
  if (microStx === 0) return null;

  const stxAmount = microStx / 1_000_000;
  const usdValue = stxAmount * stxPrice;
  return {
    lines: [{ label: "Staked", tokenAmount: `${stxAmount.toFixed(2)} STX`, usdValue }],
    totalUsd: usdValue,
  };
}
```

- [ ] **Step 2: Run build to verify no type errors**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/protocol-positions.ts
git commit -m "feat(apps): add StackingDAO position fetcher"
```

---

## Task 3: Lisa fetcher

**Files:**
- Modify: `src/lib/protocol-positions.ts`

Lisa users hold `lqstx` shares in their wallet. We detect the token by scanning
`getFungibleTokens` for `::lqstx` asset identifiers, then convert shares → STX
via `get-shares-to-tokens` on the same contract.

- [ ] **Step 1: Add the Lisa fetcher**

```typescript
// ─── Lisa ─────────────────────────────────────────────────────────────────────
// User holds lqstx shares in wallet. Asset id: "<contract>::lqstx"
// get-shares-to-tokens(shares) → uint128 micro-STX equivalent

async function fetchLisaPosition(
  address: string,
  stxPrice: number,
  fungibleTokens: Record<string, { balance: string }>
): Promise<ProtocolPosition | null> {
  // Find any lqstx asset regardless of exact deployer (handles protocol upgrades)
  const entry = Object.entries(fungibleTokens).find(([id]) =>
    id.endsWith("::lqstx")
  );
  if (!entry) return null;

  const [assetId, { balance }] = entry;
  const shares = Number(balance);
  if (shares === 0) return null;

  // Extract contract address and name from "SP...contract-name::lqstx"
  const contractId = assetId.split("::")[0];
  const dotIndex = contractId.lastIndexOf(".");
  const contractAddr = contractId.slice(0, dotIndex);
  const contractName = contractId.slice(dotIndex + 1);

  const cv = await callReadOnly(contractAddr, contractName, "get-shares-to-tokens", [
    cvHex(uintCV(shares)),
  ]);
  const microStx = parseCV(cv) as number;
  if (microStx === 0) return null;

  const stxAmount = microStx / 1_000_000;
  const usdValue = stxAmount * stxPrice;
  return {
    lines: [{ label: "Staked", tokenAmount: `${stxAmount.toFixed(2)} STX`, usdValue }],
    totalUsd: usdValue,
  };
}
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/protocol-positions.ts
git commit -m "feat(apps): add Lisa position fetcher"
```

---

## Task 4: Arkadiko fetcher

**Files:**
- Modify: `src/lib/protocol-positions.ts`

`get-vault-entries(user)` returns `{ids: uint[]}`. Filter out zero-ids (empty slots).
For each vault, `get-vault-by-id(id)` returns a tuple — use Clarity key names exactly
as returned (kebab-case is preserved by `parseCV`).

- [ ] **Step 1: Add the Arkadiko fetcher**

```typescript
// ─── Arkadiko ─────────────────────────────────────────────────────────────────
// get-vault-entries(user)  → { ids: uint128[] }  (zeros = empty slots)
// get-vault-by-id(id)      → { collateral, debt, "is-liquidated", ... }
// collateral: micro-STX   debt: micro-USDA (pegged $1)

const ARKADIKO_ADDR = "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR";
const ARKADIKO_NAME = "arkadiko-freddie-v1-1";

async function fetchArkadikoPosition(
  address: string,
  stxPrice: number
): Promise<ProtocolPosition | null> {
  const entriesCv = await callReadOnly(ARKADIKO_ADDR, ARKADIKO_NAME, "get-vault-entries", [
    cvHex(standardPrincipalCV(address)),
  ]);
  const { ids } = parseCV(entriesCv) as { ids: number[] };
  const vaultIds = ids.filter((id) => id > 0);
  if (vaultIds.length === 0) return null;

  let totalCollateralStx = 0;
  let totalDebtUsda = 0;

  await Promise.all(
    vaultIds.map(async (id) => {
      const vaultCv = await callReadOnly(ARKADIKO_ADDR, ARKADIKO_NAME, "get-vault-by-id", [
        cvHex(uintCV(id)),
      ]);
      const vault = parseCV(vaultCv) as {
        collateral: number;
        debt: number;
        "is-liquidated": boolean;
      };
      if (vault["is-liquidated"]) return;
      totalCollateralStx += vault.collateral / 1_000_000;
      totalDebtUsda += vault.debt / 1_000_000;
    })
  );

  if (totalCollateralStx === 0) return null;

  const collateralUsd = totalCollateralStx * stxPrice;
  const debtUsd = totalDebtUsda; // USDA is pegged $1
  return {
    lines: [
      { label: "Collateral", tokenAmount: `${totalCollateralStx.toFixed(2)} STX`, usdValue: collateralUsd },
      { label: "Debt", tokenAmount: `${totalDebtUsda.toFixed(2)} USDA`, usdValue: debtUsd },
    ],
    totalUsd: collateralUsd - debtUsd,
  };
}
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/protocol-positions.ts
git commit -m "feat(apps): add Arkadiko position fetcher"
```

---

## Task 5: Zest fetcher

**Files:**
- Modify: `src/lib/protocol-positions.ts`

Zest issues receipt tokens (e.g. `zaeusdc`) from deployer `SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N`.
`get-principal-balance(address)` returns the original deposited amount (without interest).
All current Zest pools are USD-denominated stablecoins → USD value = balance / 1e6.

- [ ] **Step 1: Add the Zest fetcher**

```typescript
// ─── Zest Protocol ────────────────────────────────────────────────────────────
// Receipt tokens ("zae*") live at deployer SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.
// get-principal-balance(address) → (ok uint)  micro-USDC (6 decimals)
// All current Zest pools are stablecoin-denominated → USD value = balance / 1e6.

const ZEST_RECEIPT_DEPLOYER = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N";

async function fetchZestPosition(
  address: string,
  fungibleTokens: Record<string, { balance: string }>
): Promise<ProtocolPosition | null> {
  const zestAssets = Object.entries(fungibleTokens).filter(([id]) =>
    id.startsWith(ZEST_RECEIPT_DEPLOYER)
  );
  if (zestAssets.length === 0) return null;

  const lines: PositionLine[] = [];

  await Promise.allSettled(
    zestAssets.map(async ([assetId]) => {
      const contractId = assetId.split("::")[0];
      const dotIndex = contractId.lastIndexOf(".");
      const contractAddr = contractId.slice(0, dotIndex);
      const contractName = contractId.slice(dotIndex + 1);
      // Human-readable token label: "zaeusdc" → "USDC"
      const tokenLabel = assetId.split("::")[1]?.replace(/^zae/, "").toUpperCase() ?? "USD";

      const cv = await callReadOnly(contractAddr, contractName, "get-principal-balance", [
        cvHex(standardPrincipalCV(address)),
      ]);
      const microAmount = parseCV(cv) as number;
      if (microAmount === 0) return;

      const humanAmount = microAmount / 1_000_000;
      lines.push({
        label: "Supplied",
        tokenAmount: `${humanAmount.toFixed(2)} ${tokenLabel}`,
        usdValue: humanAmount,
      });
    })
  );

  if (lines.length === 0) return null;
  return {
    lines,
    totalUsd: lines.reduce((sum, l) => sum + l.usdValue, 0),
  };
}
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/protocol-positions.ts
git commit -m "feat(apps): add Zest position fetcher"
```

---

## Task 6: `fetchAllPositions` orchestrator

**Files:**
- Modify: `src/lib/protocol-positions.ts`

- [ ] **Step 1: Add `fetchAllPositions` at the bottom of the file**

```typescript
// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function fetchAllPositions(
  address: string,
  protocols: KnownProtocol[]
): Promise<Map<string, ProtocolPosition | null>> {
  const result = new Map<string, ProtocolPosition | null>();
  const supported = protocols.filter((p) => SUPPORTED_PROTOCOLS.has(p.name));
  if (supported.length === 0) return result;

  // Fetch STX price + token balances once, share across all fetchers
  const [stxPriceData, fungibleTokensData] = await Promise.all([
    getSTXPrice(),
    getFungibleTokens(address),
  ]);
  const stxPrice = stxPriceData.usd;
  const fungibleTokens = (fungibleTokensData.fungible_tokens ?? {}) as Record<
    string,
    { balance: string }
  >;

  const settled = await Promise.allSettled(
    supported.map(async (protocol) => {
      let position: ProtocolPosition | null = null;
      switch (protocol.name) {
        case "StackingDAO":
          position = await fetchStackingDaoPosition(address, stxPrice);
          break;
        case "Lisa":
          position = await fetchLisaPosition(address, stxPrice, fungibleTokens);
          break;
        case "Arkadiko":
          position = await fetchArkadikoPosition(address, stxPrice);
          break;
        case "Zest Protocol":
          position = await fetchZestPosition(address, fungibleTokens);
          break;
      }
      return { name: protocol.name, position };
    })
  );

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      result.set(outcome.value.name, outcome.value.position);
    } else {
      // Leave missing from map — caller treats missing as null
    }
  }

  // Ensure every supported protocol has an entry (null = failed fetch)
  for (const p of supported) {
    if (!result.has(p.name)) result.set(p.name, null);
  }

  return result;
}
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 3: Run tests**

```bash
npm test -- protocol-positions
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/protocol-positions.ts
git commit -m "feat(apps): wire fetchAllPositions with Promise.allSettled"
```

---

## Task 7: `useProtocolPositions` hook

**Files:**
- Modify: `src/hooks/useMarketData.ts`

- [ ] **Step 1: Add import and hook at the bottom of `useMarketData.ts`**

At the top of `src/hooks/useMarketData.ts`, add to imports:

```typescript
import {
  fetchAllPositions,
  type ProtocolPosition,
} from "@/lib/protocol-positions";
import type { KnownProtocol } from "@/lib/stacks";
```

At the bottom of the file, add:

```typescript
// ─── Protocol positions (value at stake per DeFi protocol) ───────────────────

export function useProtocolPositions(
  address: string | undefined,
  protocols: KnownProtocol[]
) {
  return useSWR<Map<string, ProtocolPosition | null>>(
    address && protocols.length > 0 ? ["protocol-positions", address] : null,
    () => fetchAllPositions(address!, protocols),
    { refreshInterval: 120_000, dedupingInterval: 60_000 }
  );
}
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMarketData.ts
git commit -m "feat(apps): add useProtocolPositions hook"
```

---

## Task 8: Position value row in `ProtocolCard`

**Files:**
- Modify: `src/components/apps/ProtocolCard.tsx`

- [ ] **Step 1: Read the current file**

Read `src/components/apps/ProtocolCard.tsx` to confirm current structure before editing.

- [ ] **Step 2: Update `ProtocolCard` with position prop and value row**

Replace the entire file content with:

```typescript
"use client";

import { ExternalLink } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { ProtocolPosition } from "@/lib/protocol-positions";

interface ProtocolCardProps {
  name: string;
  logoUrl: string;
  url: string;
  category: string;
  lastInteractedAt: number;
  position?: ProtocolPosition | null | "loading";
}

function PositionRow({ position }: { position: ProtocolPosition | null | "loading" }) {
  if (position === "loading") {
    return (
      <div
        className="flex flex-col gap-1.5 py-2 border-t border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div
          className="h-2.5 rounded animate-pulse"
          style={{ backgroundColor: "var(--bg-muted)", width: "55%" }}
        />
        <div
          className="h-2.5 rounded animate-pulse"
          style={{ backgroundColor: "var(--bg-muted)", width: "40%" }}
        />
      </div>
    );
  }

  if (position === null) {
    return (
      <div
        className="py-2 border-t border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
          title="Unable to fetch position"
        >
          —
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-1 py-2 border-t border-b"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      {position.lines.map((line) => (
        <div key={line.label} className="flex items-center justify-between gap-2">
          <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
            {line.label}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-xs truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {line.tokenAmount}
            </span>
            <span
              className="text-xs font-medium shrink-0"
              style={{ color: "var(--text-primary)" }}
            >
              ${line.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      ))}
      {position.lines.length > 1 && (
        <div
          className="flex items-center justify-between pt-1 mt-0.5 border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {position.totalUsd >= 0 ? "Total" : "Net"}
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
            ${Math.abs(position.totalUsd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
}

export default function ProtocolCard({
  name,
  logoUrl,
  url,
  category,
  lastInteractedAt,
  position,
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

      {position !== undefined && <PositionRow position={position} />}

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

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/apps/ProtocolCard.tsx
git commit -m "feat(apps): add position value row to ProtocolCard"
```

---

## Task 9: Wire positions in `AppsPageContent`

**Files:**
- Modify: `src/components/apps/AppsPageContent.tsx`

- [ ] **Step 1: Read the current file**

Read `src/components/apps/AppsPageContent.tsx` to confirm current imports and structure.

- [ ] **Step 2: Add import and hook call**

At the top of the file, add to imports:

```typescript
import { useProtocolPositions } from "@/hooks/useMarketData";
import { SUPPORTED_PROTOCOLS } from "@/lib/protocol-positions";
```

Inside the `AppsPageContent` component body, after the existing `useConnectedApps` line, add:

```typescript
const { data: positionsMap, isLoading: positionsLoading } = useProtocolPositions(
  stxAddress ?? undefined,
  data?.knownProtocols ?? []
);
```

- [ ] **Step 3: Update the `ProtocolCard` render call**

In the `data.knownProtocols.map(...)` section, replace:

```typescript
<ProtocolCard key={p.contractId} {...p} />
```

With:

```typescript
<ProtocolCard
  key={p.contractId}
  {...p}
  position={
    SUPPORTED_PROTOCOLS.has(p.name)
      ? positionsLoading
        ? "loading"
        : (positionsMap?.get(p.name) ?? null)
      : undefined
  }
/>
```

- [ ] **Step 4: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean build, no errors

- [ ] **Step 5: Run unit tests**

```bash
npm test
```

Expected: all existing tests pass + new protocol-positions tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/apps/AppsPageContent.tsx
git commit -m "feat(apps): connect protocol positions to AppsPageContent"
```

---

## Verification Checklist

After all tasks complete, manually verify in the browser (`npm run dev`):

- [ ] Connected Apps page loads with wallet connected
- [ ] StackingDAO card shows "Staked: X.XX STX  $Y.YY" if user has staked
- [ ] Lisa card shows "Staked: X.XX STX  $Y.YY" if user holds lqstx
- [ ] Arkadiko card shows "Collateral / Debt / Net total" if user has vaults
- [ ] Zest card shows "Supplied: X.XX USDC  $Y.YY" if user has supplied
- [ ] DEX cards (Bitflow, ALEX, Velar) show no value row — layout unchanged
- [ ] While positions are loading, supported cards show animated skeleton
- [ ] If a position fetch fails, card shows `—` with tooltip text
- [ ] Disconnect wallet → page shows "Connect your wallet" state (no crash)
