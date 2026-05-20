# Unverified Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add security-aware "Unverified" badge to all unknown contract rows, fetch open-source status from Hiro API, and rename the section to "Unverified Contracts".

**Architecture:** `fetchContractInfo` in `stacks.ts` fetches Hiro's contract endpoint. `useContractInfo` SWR hook in `useMarketData.ts` wraps it per contract. `UnknownContractRow` owns its own hook call — skeleton while loading, fallback to static on error. `AppsPageContent` gets a one-line header rename.

**Tech Stack:** SWR, React `useState`, TypeScript, Tailwind CSS, Hiro REST API (`/extended/v1/contract/{id}`), Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/stacks.ts` | **Modify** | Add `fetchContractInfo` after `getConnectedApps` |
| `src/lib/contract-info.test.ts` | **Create** | Unit tests for `fetchContractInfo` return shape |
| `src/hooks/useMarketData.ts` | **Modify** | Add `useContractInfo` hook at bottom |
| `src/components/apps/UnknownContractRow.tsx` | **Modify** | Full redesign with badges, contract name, skeleton |
| `src/components/apps/AppsPageContent.tsx` | **Modify** | Rename section header |

---

## Task 1: `fetchContractInfo` + `useContractInfo` + tests

**Files:**
- Modify: `src/lib/stacks.ts` (after line 489, before the `// ─── sBTC` comment)
- Create: `src/lib/contract-info.test.ts`
- Modify: `src/hooks/useMarketData.ts` (bottom of file)

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/contract-info.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchContractInfo } from "@/lib/stacks";

describe("fetchContractInfo", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns sourceVerified: true when source_code is non-null", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ source_code: "(define-public ...)" }),
    } as Response);
    const result = await fetchContractInfo("SP123.my-contract");
    expect(result).toEqual({ sourceVerified: true });
  });

  it("returns sourceVerified: false when source_code is null", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ source_code: null }),
    } as Response);
    const result = await fetchContractInfo("SP123.my-contract");
    expect(result).toEqual({ sourceVerified: false });
  });

  it("throws when response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    await expect(fetchContractInfo("SP123.my-contract")).rejects.toThrow(
      "Failed to fetch contract info"
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- contract-info
```

Expected: FAIL with "fetchContractInfo is not exported"

- [ ] **Step 3: Add `fetchContractInfo` to `src/lib/stacks.ts`**

Insert after line 489 (`return { knownProtocols, unknownContracts };` closing brace), before the `// ─── sBTC` comment:

```typescript
// ─── Contract info ────────────────────────────────────────────────────────────

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

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- contract-info
```

Expected: 3 tests pass

- [ ] **Step 5: Add `useContractInfo` to `src/hooks/useMarketData.ts`**

Add at the very bottom of the file, after `useProtocolPositions`:

```typescript
// ─── Contract info (source code verification status) ─────────────────────────

export function useContractInfo(contractId: string | undefined) {
  return useSWR<{ sourceVerified: boolean }>(
    contractId ? ["contract-info", contractId] : null,
    () => fetchContractInfo(contractId!),
    { dedupingInterval: 300_000 }
  );
}
```

Also add `fetchContractInfo` to the import from `@/lib/stacks` at the top of `useMarketData.ts`. Find the existing import block:

```typescript
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
  getTokensWithValues,
  getPnLData,
  type PortfolioValue,
  type TrendingToken,
  type STXMarketStats,
  type STXMarketHistory,
  type ConnectedAppsResult,
  type PnLData,
  type TokenWithValue,
  type KnownProtocol,
} from "@/lib/stacks";
```

Add `fetchContractInfo` to that list:

```typescript
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
  getTokensWithValues,
  getPnLData,
  fetchContractInfo,
  type PortfolioValue,
  type TrendingToken,
  type STXMarketStats,
  type STXMarketHistory,
  type ConnectedAppsResult,
  type PnLData,
  type TokenWithValue,
  type KnownProtocol,
} from "@/lib/stacks";
```

- [ ] **Step 6: Run build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/stacks.ts src/lib/contract-info.test.ts src/hooks/useMarketData.ts
git commit -m "feat(apps): add fetchContractInfo and useContractInfo hook"
```

---

## Task 2: Redesign `UnknownContractRow`

**Files:**
- Modify: `src/components/apps/UnknownContractRow.tsx`

Current file for reference:
```typescript
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

- [ ] **Step 1: Replace the entire file**

```typescript
"use client";

import { Code2, ExternalLink } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { useContractInfo } from "@/hooks/useMarketData";

interface UnknownContractRowProps {
  contractId: string;
  lastInteractedAt: number;
}

export default function UnknownContractRow({
  contractId,
  lastInteractedAt,
}: UnknownContractRowProps) {
  const explorerUrl = `https://explorer.hiro.so/address/${contractId}?chain=mainnet`;
  const contractName = contractId.split(".")[1] ?? contractId;
  const deployer = contractId.split(".")[0];
  const truncatedDeployer = `${deployer.slice(0, 6)}...${deployer.slice(-4)}`;

  const { data: contractInfo, isLoading } = useContractInfo(contractId);

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
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-secondary)" }}>
            {contractName}
          </p>
          <span
            className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: "rgba(245,158,11,0.15)",
              color: "#d97706",
            }}
            title="Contract not recognized as a known DeFi protocol"
          >
            Unverified
          </span>
        </div>

        {isLoading ? (
          <div
            className="mt-1 h-3 w-40 rounded animate-pulse"
            style={{ backgroundColor: "var(--border-subtle)" }}
          />
        ) : (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {truncatedDeployer} · {lastInteractedAt > 0 ? timeAgo(lastInteractedAt) : "—"}
            </p>
            {contractInfo?.sourceVerified && (
              <span
                className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: "var(--accent-dim)",
                  color: "var(--accent)",
                }}
              >
                Open Source
              </span>
            )}
          </div>
        )}
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

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors

- [ ] **Step 3: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/apps/UnknownContractRow.tsx
git commit -m "feat(apps): redesign UnknownContractRow with Unverified badge and open source status"
```

---

## Task 3: Rename section header in `AppsPageContent`

**Files:**
- Modify: `src/components/apps/AppsPageContent.tsx`

- [ ] **Step 1: Find and replace the section header**

In `src/components/apps/AppsPageContent.tsx`, find:

```tsx
                  Unknown Contracts
```

Replace with:

```tsx
                  Unverified Contracts
```

(This is inside the `<h2>` in the `data.unknownContracts.length > 0` section of the else branch.)

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors

- [ ] **Step 3: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/apps/AppsPageContent.tsx
git commit -m "feat(apps): rename Unknown Contracts section to Unverified Contracts"
```

---

## Manual Verification

After all tasks, run `npm run dev` and open `http://localhost:3000` → Connected Apps tab:

- [ ] Section title reads "Unverified Contracts" (not "Unknown Contracts")
- [ ] Each contract row shows the human-readable contract name (not raw contractId)
- [ ] Every row has amber "Unverified" badge
- [ ] Hovering the badge shows tooltip "Contract not recognized as a known DeFi protocol"
- [ ] While loading: a skeleton line appears where the deployer/time info will be
- [ ] After loading: deployer (truncated) · time since last interaction
- [ ] If contract has open source code: green "Open Source" badge appears beside the deployer info
- [ ] Explorer link still works (opens Hiro Explorer in new tab)
