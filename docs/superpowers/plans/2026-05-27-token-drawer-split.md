# TokenDetailDrawer Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/components/assets/TokenDetailDrawer.tsx` (1391 LOC, 9 components) into a `drawer/` folder with one file per panel, preserving current behavior and prop shapes exactly.

**Architecture:** New folder `src/components/assets/drawer/` with `index.tsx` as the shell and one file per sub-panel. Each commit moves exactly one panel (or scaffolds/finalizes the structure). The build stays green after every commit so any commit can be reverted independently.

**Tech Stack:** Next.js 15 App Router, TypeScript, React 19, Tailwind, framer-motion. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-27-token-drawer-split-design.md`

**Critical preservation rule:** Current prop shapes are kept **exactly as today** (e.g. `TokenPnL` receives `{ token, isSTX }`, not the narrower `{ token }` from the spec exploration). Reshaping props is out of scope for this refactor — it can happen in a future round once the split is stable.

---

## Reference: current file map

`src/components/assets/TokenDetailDrawer.tsx` (1391 LOC) contains:

| Symbol | Lines | Kind |
|---|---|---|
| `formatBalance`, `formatPrice`, `truncateMiddle` | 40-58 | helper (used by shell) |
| `TokenDetailDrawer` (default export, "shell") | 60-297 | component |
| `CHART_RANGES` | 299-304 | const (used by `TokenPriceChart`) |
| `TokenPriceChart` | 306-432 | component |
| `InlineQuickSend` | 434-673 | component |
| `formatCompactUsd` | 675-681 | helper (used by `TokenMarketStats24h`) |
| `TokenMarketStats24h` | 683-733 | component |
| `timeAgo`, `formatTxAmount` | 735-752 | helpers (used by `TokenTransactions`) |
| `TokenTxRowView` | 754-818 | component (used by `TokenTransactions`) |
| `TokenTransactions` | 820-883 | component |
| `TokenPnL` | 885-987 | component |
| `StSTXYieldCard` | 989-1051 | component (used by `TokenYieldInfo`) |
| `SBTCYieldCard` | 1053-1140 | component (used by `TokenYieldInfo`) |
| `TokenYieldInfo` | 1142-1163 | component |
| `resolveSwapFrom`, `formatOut` | 1165-1180 | helpers (used by `InlineQuickSwap`) |
| `InlineQuickSwap` | 1182-1368 | component |
| `ActionButton` | 1369-1390 | component (used by shell) |

**Only one caller imports `TokenDetailDrawer`:** `src/components/assets/TokenHoldings.tsx:13`.

---

## Common workflow per extraction task

Each extraction task follows the same pattern:

1. Identify the contiguous block in `TokenDetailDrawer.tsx` (component + any helpers used *only* by it).
2. Create the new file under `drawer/`.
3. Add the necessary imports at the top of the new file. Use the existing import list in `TokenDetailDrawer.tsx` as the source of truth — copy only what the moved code uses.
4. Paste the code into the new file. Add `export default` to the primary component. Keep helpers/sub-components as local (non-exported) symbols in the new file.
5. In `TokenDetailDrawer.tsx`: delete the moved code, delete imports that are no longer used, add `import X from "./drawer/X"` at the top.
6. Run `npm run build` — must succeed.
7. Run `npm run lint` — must succeed.
8. Commit.

**Imports cleanup rule:** after each extraction, the shell's import list shrinks. Don't leave dead imports — TypeScript/ESLint will flag them, but check manually too.

---

## Task 1: Scaffold drawer folder with re-export

**Files:**
- Create: `src/components/assets/drawer/index.tsx`
- Modify: `src/components/assets/TokenHoldings.tsx:13`

This task moves nothing yet. It creates the folder, an `index.tsx` that re-exports the existing `TokenDetailDrawer`, and updates the single caller. Proves the new import path works before we touch any internals.

- [ ] **Step 1: Create `drawer/index.tsx` as a pure re-export**

```tsx
// src/components/assets/drawer/index.tsx
export { default } from "../TokenDetailDrawer";
```

- [ ] **Step 2: Update the caller to use the new path**

In `src/components/assets/TokenHoldings.tsx` change line 13:

```ts
// Before
import TokenDetailDrawer from "@/components/assets/TokenDetailDrawer";
// After
import TokenDetailDrawer from "@/components/assets/drawer";
```

- [ ] **Step 3: Verify build + lint**

```bash
npm run build
npm run lint
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/drawer/index.tsx src/components/assets/TokenHoldings.tsx
git commit -m "refactor(drawer): scaffold drawer/ folder with index re-exporting current component"
```

---

## Task 2: Extract PriceChart

**Files:**
- Create: `src/components/assets/drawer/PriceChart.tsx`
- Modify: `src/components/assets/TokenDetailDrawer.tsx` (remove lines 299-432, add import)

`TokenPriceChart` uses `CHART_RANGES` (299-304). Both move together.

- [ ] **Step 1: Create `drawer/PriceChart.tsx`**

```tsx
// src/components/assets/drawer/PriceChart.tsx
"use client";

import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { useTokenPriceHistory } from "@/hooks/useMarketData";
import { useThemeStore } from "@/store/themeStore";

// PASTE CHART_RANGES const (currently lines 299-304 of TokenDetailDrawer.tsx)
// PASTE TokenPriceChart function body (currently lines 306-432), rename `function TokenPriceChart` to `export default function PriceChart` — keep parameters and body identical
```

When pasting, ensure:
- The exported component is named `PriceChart` (default export).
- Internal references to `TokenPriceChart` (if any inside the body) are updated to `PriceChart`.
- `CHART_RANGES` stays as a module-level const above the component.
- Imports above match what the pasted code uses. If pasted code uses `formatPrice` or other helpers from the shell, copy those helper functions into this file too (local copy — small duplication is fine for this refactor; we resist creating a shared utils file per spec YAGNI rule).

Check: does the body use `formatPrice` (defined at shell lines 47-53)? If yes, paste `formatPrice` as a local helper at the top of this file.

- [ ] **Step 2: Update shell to import the new file and remove the moved code**

In `src/components/assets/TokenDetailDrawer.tsx`:

1. Add at the top of the import block:
   ```ts
   import TokenPriceChart from "./drawer/PriceChart";
   ```
2. Delete lines 299-432 (the `CHART_RANGES` const and the entire `TokenPriceChart` function).
3. Remove now-unused imports from the shell's top:
   - `ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip` from recharts
   - `useTokenPriceHistory` from `@/hooks/useMarketData` (only if not used elsewhere in shell — grep to confirm)
   - `useThemeStore` (only if not used elsewhere in shell)

Use grep to confirm before deleting an import:
```bash
grep -n "ResponsiveContainer\|AreaChart\|useTokenPriceHistory\|useThemeStore" src/components/assets/TokenDetailDrawer.tsx
```

- [ ] **Step 3: Verify build + lint**

```bash
npm run build
npm run lint
```

Expected: both pass. If lint flags unused imports, remove them.

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/drawer/PriceChart.tsx src/components/assets/TokenDetailDrawer.tsx
git commit -m "refactor(drawer): extract PriceChart"
```

---

## Task 3: Extract MarketStats

**Files:**
- Create: `src/components/assets/drawer/MarketStats.tsx`
- Modify: `src/components/assets/TokenDetailDrawer.tsx`

`TokenMarketStats24h` (lines 683-733) uses local helper `formatCompactUsd` (lines 675-681). Both move together.

- [ ] **Step 1: Create `drawer/MarketStats.tsx`**

```tsx
// src/components/assets/drawer/MarketStats.tsx
"use client";

import { useTokenMarketStats } from "@/hooks/useMarketData";
import { formatUSD } from "@/lib/utils";

// PASTE formatCompactUsd helper (currently lines 675-681)
// PASTE TokenMarketStats24h, rename `function TokenMarketStats24h` to `export default function MarketStats` — keep parameters `({ geckoId }: { geckoId: string })` and body identical
```

Verify which imports the pasted code uses — only include the imports actually referenced.

- [ ] **Step 2: Update shell**

In `src/components/assets/TokenDetailDrawer.tsx`:

1. Add import:
   ```ts
   import TokenMarketStats24h from "./drawer/MarketStats";
   ```
2. Delete lines 675-733 (the `formatCompactUsd` helper and `TokenMarketStats24h` function).
3. Remove `useTokenMarketStats` from shell imports if no longer used:
   ```bash
   grep -n "useTokenMarketStats" src/components/assets/TokenDetailDrawer.tsx
   ```

- [ ] **Step 3: Verify build + lint**

```bash
npm run build
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/drawer/MarketStats.tsx src/components/assets/TokenDetailDrawer.tsx
git commit -m "refactor(drawer): extract MarketStats"
```

---

## Task 4: Extract Transactions

**Files:**
- Create: `src/components/assets/drawer/Transactions.tsx`
- Modify: `src/components/assets/TokenDetailDrawer.tsx`

`TokenTransactions` (lines 820-883) uses `TokenTxRowView` (754-818), `timeAgo` (735-742), `formatTxAmount` (743-752). All four move together.

- [ ] **Step 1: Create `drawer/Transactions.tsx`**

```tsx
// src/components/assets/drawer/Transactions.tsx
"use client";

import { ArrowUpRight, ArrowDownLeft, Repeat, ExternalLink, Clock } from "lucide-react";
import { useTokenTransactions, type TokenTxRow } from "@/hooks/useMarketData";
// Add other imports as needed — copy from current file based on what the pasted code references

// PASTE timeAgo helper (lines 735-742)
// PASTE formatTxAmount helper (lines 743-752)
// PASTE TokenTxRowView component (lines 754-818) — keep as local (non-exported)
// PASTE TokenTransactions, rename `function TokenTransactions` to `export default function Transactions` — keep parameters and body identical
```

The pasted code's imports must match its usage. Audit by reading each function body once and listing every imported symbol it references.

- [ ] **Step 2: Update shell**

1. Add import:
   ```ts
   import TokenTransactions from "./drawer/Transactions";
   ```
2. Delete lines 735-883 (helpers + `TokenTxRowView` + `TokenTransactions`).
3. Remove `useTokenTransactions`, `TokenTxRow`, `Clock`, `ExternalLink` from shell imports if no longer referenced (grep to confirm).

- [ ] **Step 3: Verify build + lint**

```bash
npm run build
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/drawer/Transactions.tsx src/components/assets/TokenDetailDrawer.tsx
git commit -m "refactor(drawer): extract Transactions"
```

---

## Task 5: Extract PnL

**Files:**
- Create: `src/components/assets/drawer/PnL.tsx`
- Modify: `src/components/assets/TokenDetailDrawer.tsx`

`TokenPnL` is lines 885-987.

- [ ] **Step 1: Create `drawer/PnL.tsx`**

```tsx
// src/components/assets/drawer/PnL.tsx
"use client";

import { usePnLData } from "@/hooks/useMarketData";
import { useWalletStore } from "@/store/walletStore";
import { formatUSD } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
// Add other imports as needed based on pasted code

// PASTE TokenPnL, rename `function TokenPnL` to `export default function PnL` — keep parameters and body identical
```

- [ ] **Step 2: Update shell**

1. Add import:
   ```ts
   import TokenPnL from "./drawer/PnL";
   ```
2. Delete lines 885-987.
3. Remove `usePnLData` from shell imports if no longer referenced. Keep `TrendingUp`/`TrendingDown` if still used by the shell's price section (lines 208-219).

- [ ] **Step 3: Verify build + lint**

```bash
npm run build
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/drawer/PnL.tsx src/components/assets/TokenDetailDrawer.tsx
git commit -m "refactor(drawer): extract PnL"
```

---

## Task 6: Extract YieldInfo

**Files:**
- Create: `src/components/assets/drawer/YieldInfo.tsx`
- Modify: `src/components/assets/TokenDetailDrawer.tsx`

`TokenYieldInfo` (1142-1163) is a thin wrapper that delegates to `StSTXYieldCard` (989-1051) and `SBTCYieldCard` (1053-1140). All three move together.

- [ ] **Step 1: Create `drawer/YieldInfo.tsx`**

```tsx
// src/components/assets/drawer/YieldInfo.tsx
"use client";

import { useSBTCDataSnap } from "@/hooks/usePortfolioSnapshot";
import { Lock, Bitcoin } from "lucide-react";
// Add other imports as needed based on pasted code

// PASTE StSTXYieldCard component (lines 989-1051) — keep as local (non-exported)
// PASTE SBTCYieldCard component (lines 1053-1140) — keep as local (non-exported)
// PASTE TokenYieldInfo, rename `function TokenYieldInfo` to `export default function YieldInfo` — keep parameters and body identical
```

- [ ] **Step 2: Update shell**

1. Add import:
   ```ts
   import TokenYieldInfo from "./drawer/YieldInfo";
   ```
2. Delete lines 989-1163.
3. Remove `useSBTCDataSnap`, `Lock`, `Bitcoin` from shell imports if no longer referenced.

- [ ] **Step 3: Verify build + lint**

```bash
npm run build
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/drawer/YieldInfo.tsx src/components/assets/TokenDetailDrawer.tsx
git commit -m "refactor(drawer): extract YieldInfo"
```

---

## Task 7: Extract QuickSend

**Files:**
- Create: `src/components/assets/drawer/QuickSend.tsx`
- Modify: `src/components/assets/TokenDetailDrawer.tsx`

`InlineQuickSend` is lines 434-673.

- [ ] **Step 1: Create `drawer/QuickSend.tsx`**

```tsx
// src/components/assets/drawer/QuickSend.tsx
"use client";

import { useState } from "react";
import { openSTXTransfer, openContractCall } from "@stacks/connect";
import { uintCV, standardPrincipalCV, noneCV, PostConditionMode } from "@stacks/transactions";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { trackTx } from "@/lib/tx-tracker";
import { Loader2, AlertCircle, CheckCircle2, ArrowUpRight } from "lucide-react";
// Add other imports as needed based on pasted code

// PASTE InlineQuickSend, rename `function InlineQuickSend` to `export default function QuickSend` — keep parameters and body identical
```

- [ ] **Step 2: Update shell**

1. Add import:
   ```ts
   import InlineQuickSend from "./drawer/QuickSend";
   ```
2. Delete lines 434-673.
3. After this extraction, audit which shell imports are no longer used. Likely candidates: `openSTXTransfer`, `openContractCall`, `uintCV`, `standardPrincipalCV`, `noneCV`, `PostConditionMode`, `trackTx`, `Loader2`, `AlertCircle`, `CheckCircle2`. But QuickSwap (still in shell) may reuse some — confirm with grep before deleting each.

```bash
grep -n "openContractCall\|uintCV\|PostConditionMode\|trackTx\|Loader2\|AlertCircle\|CheckCircle2" src/components/assets/TokenDetailDrawer.tsx
```

- [ ] **Step 3: Verify build + lint**

```bash
npm run build
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/drawer/QuickSend.tsx src/components/assets/TokenDetailDrawer.tsx
git commit -m "refactor(drawer): extract QuickSend"
```

---

## Task 8: Extract QuickSwap

**Files:**
- Create: `src/components/assets/drawer/QuickSwap.tsx`
- Modify: `src/components/assets/TokenDetailDrawer.tsx`

`InlineQuickSwap` (1182-1368) uses local helpers `resolveSwapFrom` (1165-1173) and `formatOut` (1174-1180). All three move together.

- [ ] **Step 1: Create `drawer/QuickSwap.tsx`**

```tsx
// src/components/assets/drawer/QuickSwap.tsx
"use client";

import { useEffect, useState } from "react";
import { openContractCall } from "@stacks/connect";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { trackTx } from "@/lib/tx-tracker";
import {
  SWAP_TOKENS,
  getValidDestinations,
  getQuote,
  sanitizeAmountInput,
  type SwapToken,
} from "@/lib/direct-swap";
import { Loader2, AlertCircle, CheckCircle2, Repeat } from "lucide-react";
// Add other imports as needed based on pasted code

// PASTE resolveSwapFrom helper (lines 1165-1173)
// PASTE formatOut helper (lines 1174-1180)
// PASTE InlineQuickSwap, rename `function InlineQuickSwap` to `export default function QuickSwap` — keep parameters and body identical
```

- [ ] **Step 2: Update shell**

1. Add import:
   ```ts
   import InlineQuickSwap from "./drawer/QuickSwap";
   ```
2. Delete lines 1165-1368.
3. Remove all swap-related imports from shell that are no longer used: `SWAP_TOKENS`, `getValidDestinations`, `getQuote`, `sanitizeAmountInput`, `SwapToken`, plus any of `openContractCall`/`trackTx`/`Loader2`/etc. left behind from QuickSend if they're now only used by QuickSwap (which is no longer in shell).

```bash
grep -n "SWAP_TOKENS\|getValidDestinations\|getQuote\|sanitizeAmountInput" src/components/assets/TokenDetailDrawer.tsx
```

- [ ] **Step 3: Verify build + lint**

```bash
npm run build
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/drawer/QuickSwap.tsx src/components/assets/TokenDetailDrawer.tsx
git commit -m "refactor(drawer): extract QuickSwap"
```

---

## Task 9: Move shell into drawer/index.tsx, delete old file

**Files:**
- Modify: `src/components/assets/drawer/index.tsx` (replace re-export with real shell)
- Delete: `src/components/assets/TokenDetailDrawer.tsx`

At this point `TokenDetailDrawer.tsx` only contains: imports, the three formatter helpers (`formatBalance`, `formatPrice`, `truncateMiddle`), `ActionButton`, and the shell component. Move all of that into `drawer/index.tsx` and delete the old file.

- [ ] **Step 1: Replace `drawer/index.tsx` contents with the shell**

Open `src/components/assets/TokenDetailDrawer.tsx`. Copy its entire current contents.

Open `src/components/assets/drawer/index.tsx`. Delete the existing one-line re-export. Paste the entire shell contents.

Then in the new `drawer/index.tsx`:

1. Update relative imports — sibling extracted files were imported as `./drawer/PriceChart`, change those to `./PriceChart` (since we're now *inside* the drawer folder).

```ts
// Before (in shell):
import TokenPriceChart from "./drawer/PriceChart";
import TokenMarketStats24h from "./drawer/MarketStats";
import TokenTransactions from "./drawer/Transactions";
import TokenPnL from "./drawer/PnL";
import TokenYieldInfo from "./drawer/YieldInfo";
import InlineQuickSend from "./drawer/QuickSend";
import InlineQuickSwap from "./drawer/QuickSwap";

// After (in drawer/index.tsx):
import TokenPriceChart from "./PriceChart";
import TokenMarketStats24h from "./MarketStats";
import TokenTransactions from "./Transactions";
import TokenPnL from "./PnL";
import TokenYieldInfo from "./YieldInfo";
import InlineQuickSend from "./QuickSend";
import InlineQuickSwap from "./QuickSwap";
```

2. Verify the default export is `TokenDetailDrawer`. The caller imports it as the default, so name is internal — leave it as `TokenDetailDrawer` to minimise diff.

- [ ] **Step 2: Delete the old file**

```bash
rm src/components/assets/TokenDetailDrawer.tsx
```

- [ ] **Step 3: Verify build + lint**

```bash
npm run build
npm run lint
```

Expected: both pass. The single import in `TokenHoldings.tsx` (`@/components/assets/drawer`) still resolves because `drawer/index.tsx` still has a default export.

- [ ] **Step 4: Manual smoke (per spec verification strategy)**

Start dev server and open the assets page:

```bash
npm run dev
```

Open `http://localhost:3000/assets`, connect wallet (or use existing connection), open the holdings tab, and verify:

- Click STX row → drawer opens with: header (icon, name, balance), PnL panel (if cost basis exists), price + chart, market stats, quick-swap form, quick-send form, recent transactions, 4 action buttons, contract metadata at bottom.
- Click sBTC row → drawer additionally shows the sBTC yield card.
- Click stSTX row (if held) → drawer additionally shows the stSTX yield card.
- Press ESC → drawer closes.
- Click backdrop → drawer closes.
- Click X button → drawer closes.
- Click copy contract button → checkmark appears for ~1.5s.
- Click Swap action → navigates to `/trade?from=...` and drawer closes.
- Type an amount in quick-swap → quote updates.
- Type an amount in quick-send → submit button enables when valid.

If any panel renders blank or throws, the most likely cause is a missing import in the extracted file — read the dev console error and add the import to the relevant `drawer/*.tsx`.

Free port 3000 when done:

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add src/components/assets/drawer/index.tsx src/components/assets/TokenDetailDrawer.tsx
git commit -m "refactor(drawer): move shell into drawer/index.tsx, delete TokenDetailDrawer.tsx"
```

(`git add` of the deleted file path stages the deletion.)

---

## Final verification

After Task 9:

- [ ] Run the full Playwright suite if convenient: `npm run test:e2e` (optional — refactor is unlikely to break tests, but it's a clean signal).
- [ ] `git log --oneline -10` shows the nine refactor commits in order.
- [ ] `ls src/components/assets/drawer/` lists exactly: `index.tsx`, `PriceChart.tsx`, `MarketStats.tsx`, `Transactions.tsx`, `PnL.tsx`, `YieldInfo.tsx`, `QuickSend.tsx`, `QuickSwap.tsx` (8 files).
- [ ] `wc -l src/components/assets/drawer/*.tsx` — no file should be >250 LOC except possibly `QuickSend.tsx` (~240) and `index.tsx` (~200).
- [ ] `src/components/assets/TokenDetailDrawer.tsx` no longer exists.
