# Earn Hub v1 — Liquid Stacking (stSTX) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a StacksPort user stake STX → mint liquid stSTX in-app via StackingDAO, see their position, get nudged when STX sits idle, and unstake by swapping — all non-custodial, no new contract.

**Architecture:** Pure logic (constants, amount math, Clarity param builder) lives in `src/lib/domain/stacking/` with vitest unit tests, mirroring `domain/swap/`. Side effects (the wallet `deposit` call + best-effort exchange-rate read) live in `src/lib/stacking-dao.ts`, mirroring `dca.ts`. UI extends the existing `YieldOpportunities` card + adds a `StakeStxModal` and an `IdleStxNudge`, all i18n-aware across 4 locales.

**Tech Stack:** Next.js 15 (App Router, `[locale]` i18n via next-intl), `@stacks/connect` ^8.2.5 (`openContractCall`), `@stacks/transactions` ^7.3.1 (`Pc`, `PostConditionMode`), Zustand stores, vitest (node env), Playwright e2e.

**Contract facts (verified against mainnet `/v2/contracts/interface`):**
- Core: `SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-v1`
- `deposit(reserve-contract: trait, stx-amount: uint, referrer: (optional principal)) -> (response uint uint)`
- Reserve (trait target): `SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.reserve-v1` (confirmed exists)
- `get-stx-per-ststx-helper(stx-amount: uint) -> uint` (read-only, for estimate)
- `get-stx-balance(address: principal) -> uint` (already used in `protocol-positions.ts`)
- stSTX token: `SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token` (decimals 6; in `token-registry.ts`)

**Notes / deviations from spec:**
- Notifications reuse the existing `'wallet'` `NotificationCategory` (no new category — avoids touching the notification type system, preferences, and filter UI in v1).
- No new `/earn` route (per spec): we extend the existing `YieldOpportunities` card on the assets page.
- No RTL component tests exist (vitest is node-env). Pure logic → unit tests. UI → `npm run lint` + `npm run build` typecheck + a Playwright smoke test.
- Post-conditions guard only the **outgoing STX** (exact amount, Deny mode). The minted stSTX is variable (live exchange rate) and intentionally not post-conditioned.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/domain/stacking/contracts.ts` (create) | Contract coordinates + client-side guards (min, fee buffer) |
| `src/lib/domain/stacking/amount.ts` (create) | Pure helpers: `idleStx`, `validateStakeAmount`, `estimateStStxReceived` |
| `src/lib/domain/stacking/amount.test.ts` (create) | Unit tests for amount helpers |
| `src/lib/domain/stacking/clarity.ts` (create) | Pure `buildStakeParams` (functionArgs + post-conditions) |
| `src/lib/domain/stacking/clarity.test.ts` (create) | Unit tests for the param builder |
| `src/lib/stacking-dao.ts` (create) | `stakeStx` (wallet call) + `fetchStxPerStStx` (read-only) |
| `messages/{en,vi,ja,zh}.json` (modify) | `assets.stake` keys + updated `assets.yield` stacking copy |
| `src/components/assets/StakeStxModal.tsx` (create) | Stake form, estimate, submit, success, unstake link |
| `src/components/assets/YieldOpportunities.tsx` (modify) | Stacking row opens the modal instead of linking out |
| `src/components/assets/IdleStxNudge.tsx` (create) | Idle-STX prompt → opens the modal |
| `src/components/assets/AssetsPageContent.tsx` (modify) | Render `<IdleStxNudge />` |
| `e2e/earn-stake.spec.ts` (create) | Playwright smoke: stake CTA renders & opens modal |

---

## Task 1: Contract constants

**Files:**
- Create: `src/lib/domain/stacking/contracts.ts`

- [ ] **Step 1: Write the constants file**

```ts
// src/lib/domain/stacking/contracts.ts
// StackingDAO liquid-stacking contract coordinates + client-side guards.
// Pure constants — no fetch, no signing.

export const STACKING_DAO = {
  address: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG",
  name: "stacking-dao-core-v1",
} as const;

// Reserve contract passed as the `deposit` trait argument.
export const RESERVE = {
  address: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG",
  name: "reserve-v1",
} as const;

export const STSTX_TOKEN = {
  address: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG",
  name: "ststx-token",
} as const;

// Client-side UX guards. The contract enforces its own minimum; these just
// avoid a wasted signing fee on a tx that would revert and reserve STX for
// the transaction fee. All values in micro-STX (1 STX = 1_000_000).
export const MIN_STAKE_USTX = 1_000_000; // 1 STX
export const FEE_BUFFER_USTX = 500_000; // 0.5 STX kept for fees
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `contracts.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/domain/stacking/contracts.ts
git commit -m "feat(stacking): add StackingDAO contract constants"
```

---

## Task 2: Amount helpers (TDD)

**Files:**
- Create: `src/lib/domain/stacking/amount.ts`
- Test: `src/lib/domain/stacking/amount.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/domain/stacking/amount.test.ts
import { describe, it, expect } from "vitest";
import { idleStx, validateStakeAmount, estimateStStxReceived } from "./amount";

describe("idleStx", () => {
  it("subtracts the fee buffer from the unlocked balance", () => {
    expect(idleStx(2_000_000)).toBe(1_500_000); // 2 STX - 0.5 buffer
  });
  it("never returns negative", () => {
    expect(idleStx(100_000)).toBe(0);
  });
});

describe("validateStakeAmount", () => {
  it("rejects amounts below the minimum", () => {
    expect(validateStakeAmount(500_000, 10_000_000)).toEqual({ ok: false, reason: "below-min" });
  });
  it("rejects amounts above the available balance", () => {
    expect(validateStakeAmount(11_000_000, 10_000_000)).toEqual({ ok: false, reason: "exceeds-balance" });
  });
  it("accepts a valid amount", () => {
    expect(validateStakeAmount(5_000_000, 10_000_000)).toEqual({ ok: true });
  });
});

describe("estimateStStxReceived", () => {
  it("returns floored micro-stSTX given the micro-STX-per-stSTX rate", () => {
    // 10 STX at a rate of 1.25 STX per stSTX -> 8 stSTX
    expect(estimateStStxReceived(10_000_000, 1_250_000)).toBe(8_000_000);
  });
  it("returns 0 for a non-positive rate", () => {
    expect(estimateStStxReceived(10_000_000, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/domain/stacking/amount.test.ts`
Expected: FAIL — cannot resolve `./amount`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/domain/stacking/amount.ts
// Pure helpers for the staking flow. No fetch, no signing.

import { MIN_STAKE_USTX, FEE_BUFFER_USTX } from "./contracts";

/** STX (micro) eligible to stake: unlocked balance minus the fee buffer. */
export function idleStx(unlockedUstx: number): number {
  return Math.max(0, unlockedUstx - FEE_BUFFER_USTX);
}

export type StakeValidation =
  | { ok: true }
  | { ok: false; reason: "below-min" | "exceeds-balance" };

/** Validate a desired stake amount (micro-STX) against min + available idle balance. */
export function validateStakeAmount(amountUstx: number, availableUstx: number): StakeValidation {
  if (amountUstx < MIN_STAKE_USTX) return { ok: false, reason: "below-min" };
  if (amountUstx > availableUstx) return { ok: false, reason: "exceeds-balance" };
  return { ok: true };
}

/**
 * stSTX (micro) received for a STX deposit (micro), given
 * `stxPerStStxUstx` = micro-STX value of 1 stSTX (>= 1_000_000 since stSTX
 * appreciates against STX). Floored. Best-effort display only.
 */
export function estimateStStxReceived(stxAmountUstx: number, stxPerStStxUstx: number): number {
  if (stxPerStStxUstx <= 0) return 0;
  return Math.floor((stxAmountUstx * 1_000_000) / stxPerStStxUstx);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/domain/stacking/amount.test.ts`
Expected: PASS (7 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/stacking/amount.ts src/lib/domain/stacking/amount.test.ts
git commit -m "feat(stacking): add pure amount/validation/estimate helpers"
```

---

## Task 3: Clarity param builder (TDD)

**Files:**
- Create: `src/lib/domain/stacking/clarity.ts`
- Test: `src/lib/domain/stacking/clarity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/domain/stacking/clarity.test.ts
import { describe, it, expect } from "vitest";
import { PostConditionMode } from "@stacks/transactions";
import { buildStakeParams } from "./clarity";

const SENDER = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";

describe("buildStakeParams", () => {
  const p = buildStakeParams(5_000_000, SENDER);

  it("targets the StackingDAO core deposit function", () => {
    expect(p.contractAddress).toBe("SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG");
    expect(p.contractName).toBe("stacking-dao-core-v1");
    expect(p.functionName).toBe("deposit");
  });

  it("passes reserve, amount, and no referrer (3 args)", () => {
    expect(p.functionArgs).toHaveLength(3);
  });

  it("guards exactly the staked STX with a single post-condition in Deny mode", () => {
    expect(p.postConditions).toHaveLength(1);
    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/domain/stacking/clarity.test.ts`
Expected: FAIL — cannot resolve `./clarity`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/domain/stacking/clarity.ts
// Pure Clarity value-object builder for the StackingDAO deposit. Mirrors
// domain/swap/clarity.ts: builds immutable params; no fetch, no broadcast.

import {
  contractPrincipalCV,
  uintCV,
  noneCV,
  Pc,
  PostConditionMode,
  type PostCondition,
  type ClarityValue,
} from "@stacks/transactions";

import { STACKING_DAO, RESERVE } from "./contracts";

export interface StakeParams {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditions: PostCondition[];
  postConditionMode: PostConditionMode;
}

/**
 * Build the `stacking-dao-core-v1.deposit` params for staking
 * `stxAmountUstx` micro-STX from `senderAddress`. The post-condition pins
 * EXACTLY `stxAmountUstx` micro-STX leaving the wallet; Deny mode blocks any
 * other unexpected transfer. Minted stSTX (variable) is not post-conditioned.
 */
export function buildStakeParams(stxAmountUstx: number, senderAddress: string): StakeParams {
  return {
    contractAddress: STACKING_DAO.address,
    contractName: STACKING_DAO.name,
    functionName: "deposit",
    functionArgs: [
      contractPrincipalCV(RESERVE.address, RESERVE.name),
      uintCV(stxAmountUstx),
      noneCV(),
    ],
    postConditions: [Pc.principal(senderAddress).willSendEq(stxAmountUstx).ustx()],
    postConditionMode: PostConditionMode.Deny,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/domain/stacking/clarity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/stacking/clarity.ts src/lib/domain/stacking/clarity.test.ts
git commit -m "feat(stacking): add deposit Clarity param builder with STX post-condition"
```

---

## Task 4: Stake action + exchange-rate read

**Files:**
- Create: `src/lib/stacking-dao.ts`

- [ ] **Step 1: Verify the exchange-rate helper semantics (manual, BEFORE coding the read)**

Run:
```bash
curl -s "https://api.hiro.so/v2/contracts/call-read/SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG/stacking-dao-core-v1/get-stx-per-ststx-helper" \
  -H "Content-Type: application/json" \
  -d '{"sender":"SP000000000000000000002Q6VF78","arguments":["0x010000000000000000000000000f4240"]}'
```
(The hex arg is `uint 1000000` = 1 STX.)
Expected: `{"okay":true,"result":"0x01..."}`. Decode the result uint: it should be in the range **~1_000_000–1_300_000** (micro-STX value of 1 stSTX). If it is, `fetchStxPerStStx` below is correct as written. If the magnitude is wildly different (e.g. ~770_000), the helper returns stSTX-per-STX instead — in that case invert in `estimateStStxReceived`'s caller and note it. Record the observed value in the commit message.

- [ ] **Step 2: Write the implementation**

```ts
// src/lib/stacking-dao.ts
// StackingDAO liquid-stacking side effects: the wallet deposit call and a
// best-effort exchange-rate read. Pure param/amount logic lives in
// domain/stacking/*.

import { openContractCall } from "@stacks/connect";
import {
  serializeCV,
  hexToCV,
  uintCV,
  ClarityType,
  type ClarityValue,
} from "@stacks/transactions";
import { buildStakeParams } from "./domain/stacking/clarity";
import { STACKING_DAO } from "./domain/stacking/contracts";

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

/** Submit a StackingDAO deposit (stake STX → mint stSTX). Mirrors dca.ts. */
export function stakeStx(
  stxAmountUstx: number,
  senderAddress: string,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const p = buildStakeParams(stxAmountUstx, senderAddress);
  openContractCall({
    contractAddress: p.contractAddress,
    contractName: p.contractName,
    functionName: p.functionName,
    functionArgs: p.functionArgs,
    postConditions: p.postConditions,
    postConditionMode: p.postConditionMode,
    network: "mainnet",
    onFinish,
    onCancel,
  });
}

function cvHex(cv: ClarityValue): string {
  const r = serializeCV(cv);
  return "0x" + (typeof r === "string" ? r : Buffer.from(r as Uint8Array).toString("hex"));
}

/**
 * Best-effort micro-STX value of 1 stSTX, used only to show an estimate
 * before signing. Returns null on any failure so the UI hides the estimate
 * without blocking staking. (Semantics verified in Step 1.)
 */
export async function fetchStxPerStStx(): Promise<number | null> {
  try {
    const res = await fetch(
      `${HIRO_API}/v2/contracts/call-read/${STACKING_DAO.address}/${STACKING_DAO.name}/get-stx-per-ststx-helper`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: DUMMY_SENDER, arguments: [cvHex(uintCV(1_000_000))] }),
        signal: AbortSignal.timeout(8_000),
      }
    );
    const json = await res.json();
    if (!json.okay) return null;
    const cv = hexToCV(json.result) as { type: ClarityType; value?: unknown };
    if (cv.type === ClarityType.UInt) return Number((cv as { value: bigint }).value);
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stacking-dao.ts
git commit -m "feat(stacking): add stakeStx action and best-effort exchange-rate read"
```

---

## Task 5: i18n keys (4 locales)

**Files:**
- Modify: `messages/en.json`, `messages/vi.json`, `messages/ja.json`, `messages/zh.json`

- [ ] **Step 1: Add an `assets.stake` block to each catalog**

In each file, inside the top-level `"assets"` object, add a sibling `"stake"` key.

`messages/en.json` → `assets.stake`:
```json
"stake": {
  "title": "Stake STX",
  "subtitle": "Receive liquid stSTX — earn stacking yield with no lockup.",
  "amountLabel": "Amount to stake",
  "balance": "Available: {balance} STX",
  "max": "Max",
  "estReceive": "You'll receive ≈ {amount} stSTX",
  "estNote": "Final amount set by the live exchange rate.",
  "minError": "Minimum stake is {min} STX.",
  "balanceError": "Amount exceeds your available STX.",
  "submit": "Stake STX",
  "submitting": "Confirming…",
  "submittedTitle": "Stake submitted",
  "submittedDesc": "Your stSTX will appear once the transaction confirms.",
  "txConfirmed": "STX staked",
  "txLabel": "Stake STX",
  "unstake": "Unstake (swap stSTX → STX)",
  "currentPosition": "Staked: {amount} STX",
  "connectFirst": "Connect your wallet to stake.",
  "nudgeTitle": "{amount} STX sitting idle",
  "nudgeBody": "Stake it as stSTX to earn ~{apy}% with no lockup.",
  "nudgeCta": "Stake now"
}
```

`messages/vi.json` → `assets.stake`:
```json
"stake": {
  "title": "Stake STX",
  "subtitle": "Nhận stSTX thanh khoản — kiếm lợi suất stacking, không khóa vốn.",
  "amountLabel": "Số lượng stake",
  "balance": "Khả dụng: {balance} STX",
  "max": "Tối đa",
  "estReceive": "Bạn sẽ nhận ≈ {amount} stSTX",
  "estNote": "Số lượng cuối cùng theo tỷ giá thực tế.",
  "minError": "Stake tối thiểu là {min} STX.",
  "balanceError": "Vượt quá số STX khả dụng.",
  "submit": "Stake STX",
  "submitting": "Đang xác nhận…",
  "submittedTitle": "Đã gửi giao dịch stake",
  "submittedDesc": "stSTX sẽ xuất hiện khi giao dịch được xác nhận.",
  "txConfirmed": "Đã stake STX",
  "txLabel": "Stake STX",
  "unstake": "Rút (swap stSTX → STX)",
  "currentPosition": "Đang stake: {amount} STX",
  "connectFirst": "Kết nối ví để stake.",
  "nudgeTitle": "{amount} STX đang nhàn rỗi",
  "nudgeBody": "Stake thành stSTX để kiếm ~{apy}% mà không khóa vốn.",
  "nudgeCta": "Stake ngay"
}
```

`messages/ja.json` → `assets.stake`:
```json
"stake": {
  "title": "STXをステーク",
  "subtitle": "流動性のあるstSTXを受け取り、ロックなしでステーキング利回りを獲得。",
  "amountLabel": "ステーク額",
  "balance": "利用可能: {balance} STX",
  "max": "最大",
  "estReceive": "受取見込み ≈ {amount} stSTX",
  "estNote": "最終額は実勢レートで確定します。",
  "minError": "最小ステーク額は {min} STX です。",
  "balanceError": "利用可能なSTXを超えています。",
  "submit": "STXをステーク",
  "submitting": "確認中…",
  "submittedTitle": "ステークを送信しました",
  "submittedDesc": "取引が確認されるとstSTXが表示されます。",
  "txConfirmed": "STXをステークしました",
  "txLabel": "STXステーク",
  "unstake": "アンステーク（stSTX → STX をスワップ）",
  "currentPosition": "ステーク中: {amount} STX",
  "connectFirst": "ステークするにはウォレットを接続してください。",
  "nudgeTitle": "{amount} STX が未活用です",
  "nudgeBody": "stSTXとしてステークし、ロックなしで約{apy}%を獲得。",
  "nudgeCta": "今すぐステーク"
}
```

`messages/zh.json` → `assets.stake`:
```json
"stake": {
  "title": "质押 STX",
  "subtitle": "获得流动性 stSTX —— 赚取质押收益，无锁仓。",
  "amountLabel": "质押数量",
  "balance": "可用：{balance} STX",
  "max": "最大",
  "estReceive": "预计获得 ≈ {amount} stSTX",
  "estNote": "最终数量由实时汇率决定。",
  "minError": "最低质押为 {min} STX。",
  "balanceError": "超过可用 STX 数量。",
  "submit": "质押 STX",
  "submitting": "确认中…",
  "submittedTitle": "质押已提交",
  "submittedDesc": "交易确认后将显示您的 stSTX。",
  "txConfirmed": "STX 已质押",
  "txLabel": "质押 STX",
  "unstake": "赎回（将 stSTX 兑换为 STX）",
  "currentPosition": "已质押：{amount} STX",
  "connectFirst": "请连接钱包以质押。",
  "nudgeTitle": "{amount} STX 闲置中",
  "nudgeBody": "质押为 stSTX，无锁仓即可赚取约 {apy}%。",
  "nudgeCta": "立即质押"
}
```

- [ ] **Step 2: Update the existing `assets.yield` stacking copy to liquid-stacking wording**

In each catalog, change these two existing keys under `assets.yield`:

- `en`: `"stackingLabel": "Liquid Stacking (stSTX)"`, `"stackingDesc": "Stake STX for liquid stSTX — earn stacking yield with no lockup."`
- `vi`: `"stackingLabel": "Liquid Stacking (stSTX)"`, `"stackingDesc": "Stake STX để nhận stSTX thanh khoản — kiếm lợi suất stacking, không khóa vốn."`
- `ja`: `"stackingLabel": "リキッドステーキング (stSTX)"`, `"stackingDesc": "STXをステークして流動的なstSTXを取得 — ロックなしでステーキング利回りを獲得。"`
- `zh`: `"stackingLabel": "流动性质押 (stSTX)"`, `"stackingDesc": "质押 STX 获得流动性 stSTX —— 无锁仓赚取质押收益。"`

- [ ] **Step 3: Verify all four catalogs are valid JSON**

Run: `node -e "for (const l of ['en','vi','ja','zh']) { JSON.parse(require('fs').readFileSync('messages/'+l+'.json','utf8')); console.log(l,'ok'); }"`
Expected: `en ok`, `vi ok`, `ja ok`, `zh ok`.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/vi.json messages/ja.json messages/zh.json
git commit -m "i18n(stacking): add assets.stake keys and update liquid-stacking copy"
```

---

## Task 6: StakeStxModal component

**Files:**
- Create: `src/components/assets/StakeStxModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/assets/StakeStxModal.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Lock, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";
import { stakeStx, fetchStxPerStStx } from "@/lib/stacking-dao";
import { trackTx } from "@/lib/tx-tracker";
import { stxToMicro, microToSTX } from "@/lib/dca";
import { idleStx, validateStakeAmount, estimateStStxReceived } from "@/lib/domain/stacking/amount";
import { MIN_STAKE_USTX } from "@/lib/domain/stacking/contracts";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Liquid (unlocked) STX balance in STX units. */
  availableStx: number;
  /** Current stSTX position in STX-equivalent units (0 if none). */
  stStxStakedStx?: number;
}

export default function StakeStxModal({ open, onClose, availableStx, stStxStakedStx = 0 }: Props) {
  const t = useTranslations("assets.stake");
  const { stxAddress, isConnected } = useWalletStore();
  const { addNotification } = useNotificationStore();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);

  // Best-effort exchange rate for the "you'll receive" estimate.
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchStxPerStStx().then((r) => { if (active) setRate(r); });
    return () => { active = false; };
  }, [open]);

  // Reset transient state each time the modal opens.
  useEffect(() => {
    if (open) { setAmount(""); setTxId(null); setLoading(false); }
  }, [open]);

  if (!open) return null;

  const availableUstx = idleStx(stxToMicro(availableStx));
  const amt = Number(amount);
  const amountUstx = Number.isFinite(amt) && amt > 0 ? stxToMicro(amt) : 0;
  const validation = validateStakeAmount(amountUstx, availableUstx);
  const estStStx = rate ? microToSTX(estimateStStxReceived(amountUstx, rate)) : null;

  const errorText =
    amountUstx === 0
      ? null
      : validation.ok
      ? null
      : validation.reason === "below-min"
      ? t("minError", { min: MIN_STAKE_USTX / 1_000_000 })
      : t("balanceError");

  const handleSubmit = () => {
    if (!isConnected || !stxAddress) { addNotification(t("connectFirst"), "error", "wallet", 5000); return; }
    if (!validation.ok) return;
    setLoading(true);
    stakeStx(
      amountUstx,
      stxAddress,
      ({ txId }) => {
        setTxId(txId);
        setLoading(false);
        addNotification(t("submittedTitle"), "info", "wallet", 5000, { txId, action: "created" });
        trackTx({
          txId,
          label: t("txLabel"),
          category: "wallet",
          context: { txId, action: "created", tokenSymbol: "stSTX", amount: String(amt) },
          addNotification,
          address: stxAddress,
        });
      },
      () => { setLoading(false); }
    );
  };

  const setMax = () => setAmount(String(microToSTX(availableUstx)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="glass-card rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4" style={{ boxShadow: "var(--shadow-card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-dim)" }}>
              <Lock size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("title")}</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t("subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} style={{ color: "var(--text-muted)" }} /></button>
        </div>

        {txId ? (
          <div className="flex flex-col gap-2">
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("submittedTitle")}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("submittedDesc")}</p>
            <a className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--accent)" }}
               href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
              {txId.slice(0, 10)}… <ArrowUpRight size={11} />
            </a>
          </div>
        ) : (
          <>
            {stStxStakedStx > 0 && (
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {t("currentPosition", { amount: stStxStakedStx.toFixed(2) })}
              </p>
            )}

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{t("amountLabel")}</label>
                <button className="text-[11px] font-semibold" style={{ color: "var(--accent)" }} onClick={setMax}>{t("max")}</button>
              </div>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="w-full rounded-xl px-3 py-2 text-sm bg-transparent border"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
              />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {t("balance", { balance: microToSTX(availableUstx).toFixed(2) })}
              </p>
            </div>

            {estStStx !== null && amountUstx > 0 && validation.ok && (
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                <p style={{ color: "var(--text-primary)" }}>{t("estReceive", { amount: estStStx.toFixed(2) })}</p>
                <p>{t("estNote")}</p>
              </div>
            )}

            {errorText && <p className="text-[11px]" style={{ color: "#ef4444" }}>{errorText}</p>}

            <button
              disabled={loading || !validation.ok}
              onClick={handleSubmit}
              className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#04130d" }}
            >
              {loading ? t("submitting") : t("submit")}
            </button>

            {stStxStakedStx > 0 && (
              <Link href="/trade" className="text-[11px] font-semibold text-center flex items-center justify-center gap-1" style={{ color: "var(--text-muted)" }}>
                {t("unstake")} <ArrowUpRight size={11} />
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: no errors for `StakeStxModal.tsx`. (If `microToSTX` is not exported from `@/lib/dca`, confirm its export — it is used by `CreatePlanForm.tsx` from the same module.)

- [ ] **Step 3: Commit**

```bash
git add src/components/assets/StakeStxModal.tsx
git commit -m "feat(stacking): add StakeStxModal stake flow component"
```

---

## Task 7: Wire the YieldOpportunities stacking row to the modal

**Files:**
- Modify: `src/components/assets/YieldOpportunities.tsx`

- [ ] **Step 1: Add state, the modal, and a button for the stacking row**

Make these edits to `src/components/assets/YieldOpportunities.tsx`:

1. Update imports (add `useState`, `StakeStxModal`):
```tsx
import { memo, useMemo, useState } from "react";
// ...existing imports...
import StakeStxModal from "./StakeStxModal";
```

2. Inside `function YieldOpportunities()`, after the existing `const { data: tokens } = useTokensWithValues(addr);` line, add:
```tsx
  const [stakeOpen, setStakeOpen] = useState(false);
  const stxAvailable = useMemo(
    () => (tokens?.tokens ?? []).find((t) => t.symbol === "STX")?.balance ?? 0,
    [tokens]
  );
  const stStxStaked = useMemo(
    () => (tokens?.tokens ?? []).find((t) => t.symbol === "stSTX")?.balance ?? 0,
    [tokens]
  );
```

3. In the action-rendering block (currently `o.external ? <a> : <Link>`), special-case the stacking row. Replace that ternary with:
```tsx
                {o.id === "stacking" ? (
                  <button
                    onClick={() => setStakeOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {o.actionLabel}
                    <ArrowUpRight size={10} />
                  </button>
                ) : o.external ? (
                  <a
                    href={o.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {o.actionLabel}
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <Link
                    href={o.href}
                    className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {o.actionLabel}
                    <ArrowUpRight size={10} />
                  </Link>
                )}
```

4. In `BASE_OPPORTUNITIES`, set the stacking entry's `external` to `false` (it no longer links out):
```tsx
    // stacking entry:
    href: "https://stacking.club",
    external: false,
```

5. Render the modal just before the closing `</div>` of the card (after the disclaimer `<p>`):
```tsx
      <StakeStxModal
        open={stakeOpen}
        onClose={() => setStakeOpen(false)}
        availableStx={stxAvailable}
        stStxStakedStx={stStxStaked}
      />
```

- [ ] **Step 2: Verify it compiles, lints, and builds**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint && npm run build`
Expected: build succeeds; no type/lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/assets/YieldOpportunities.tsx
git commit -m "feat(stacking): open StakeStxModal from the YieldOpportunities stacking row"
```

---

## Task 8: Idle-STX nudge

**Files:**
- Create: `src/components/assets/IdleStxNudge.tsx`
- Modify: `src/components/assets/AssetsPageContent.tsx`

- [ ] **Step 1: Write the nudge component**

```tsx
// src/components/assets/IdleStxNudge.tsx
"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useTokensWithValues } from "@/hooks/useMarketData";
import { stxToMicro, microToSTX } from "@/lib/dca";
import { idleStx } from "@/lib/domain/stacking/amount";
import { MIN_STAKE_USTX } from "@/lib/domain/stacking/contracts";
import StakeStxModal from "./StakeStxModal";

// Headline APY shown in the nudge — same sourced estimate as YieldOpportunities.
const STACKING_APY = 8;

export default function IdleStxNudge() {
  const t = useTranslations("assets.stake");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: tokens } = useTokensWithValues(addr);
  const [open, setOpen] = useState(false);

  const stxAvailable = useMemo(
    () => (tokens?.tokens ?? []).find((t) => t.symbol === "STX")?.balance ?? 0,
    [tokens]
  );
  const stStxStaked = useMemo(
    () => (tokens?.tokens ?? []).find((t) => t.symbol === "stSTX")?.balance ?? 0,
    [tokens]
  );

  const idleUstx = idleStx(stxToMicro(stxAvailable));
  const eligible = addr && idleUstx >= MIN_STAKE_USTX && stStxStaked === 0;

  if (!eligible) return null;

  return (
    <div className="glass-card rounded-2xl p-4 flex items-center gap-3" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--accent-dim)" }}>
        <Sparkles size={16} style={{ color: "var(--accent)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
          {t("nudgeTitle", { amount: microToSTX(idleUstx).toFixed(0) })}
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {t("nudgeBody", { apy: STACKING_APY })}
        </p>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl px-3 py-2 text-xs font-semibold shrink-0"
        style={{ background: "var(--accent)", color: "#04130d" }}
      >
        {t("nudgeCta")}
      </button>
      <StakeStxModal open={open} onClose={() => setOpen(false)} availableStx={stxAvailable} stStxStakedStx={stStxStaked} />
    </div>
  );
}
```

- [ ] **Step 2: Render the nudge in `AssetsPageContent.tsx`**

Add the import near the other component imports:
```tsx
import IdleStxNudge from "./IdleStxNudge";
```
Then render `<IdleStxNudge />` immediately before the existing `<YieldOpportunities />` element in the JSX.

- [ ] **Step 3: Verify it compiles, lints, and builds**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/IdleStxNudge.tsx src/components/assets/AssetsPageContent.tsx
git commit -m "feat(stacking): add idle-STX nudge on the assets page"
```

---

## Task 9: Playwright smoke test

**Files:**
- Create: `e2e/earn-stake.spec.ts`

> Aligns with the existing `e2e/` suite. This is a no-wallet smoke test: it confirms the stacking row renders the in-app "Stake" action and that clicking it opens the modal (no signing). Deeper signed-flow e2e (using the repo's wallet fixtures) is a follow-up.

- [ ] **Step 1: Write the test**

```ts
// e2e/earn-stake.spec.ts
import { test, expect } from "@playwright/test";

test("yield card exposes an in-app stake action that opens the modal", async ({ page }) => {
  await page.goto("/en/assets");

  // The stacking row's action is now a button (was an external link).
  const stakeAction = page.getByRole("button", { name: /stak/i }).first();
  await expect(stakeAction).toBeVisible();

  await stakeAction.click();

  // Modal title from messages/en.json → assets.stake.title
  await expect(page.getByText("Stake STX", { exact: false })).toBeVisible();
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- earn-stake.spec.ts`
Expected: PASS. (If the dev server/baseURL needs starting, follow the same setup the existing `e2e/dca.spec.ts` relies on — check `playwright.config.ts` `webServer`.)

- [ ] **Step 3: Commit**

```bash
git add e2e/earn-stake.spec.ts
git commit -m "test(e2e): smoke-test the in-app stake action on the assets page"
```

---

## Task 10: Full verification pass

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: all tests pass, including the new `domain/stacking/*` tests.

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: Manual sanity (connected wallet, mainnet)**

- Open `/assets` with a wallet holding > 1.5 STX and no stSTX → the idle nudge shows; the yield card's stacking row says "Start stacking".
- Click "Stake now" / "Start stacking" → modal opens, Max fills the idle amount, an "≈ stSTX" estimate appears.
- Submit a small amount (e.g. 1 STX) → wallet prompts a `deposit` to `stacking-dao-core-v1` with a single STX post-condition; on confirm, a "STX staked" notification fires and the stSTX position appears.

- [ ] **Step 4: Final commit (if any sanity fixups were needed)**

```bash
git add -A
git commit -m "chore(stacking): verification fixups for liquid-stacking v1"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** stake action (Tasks 1–4, 6), position view via existing `protocol-positions`/`tokens` + `currentPosition` (Task 6), APY headline (existing `YieldOpportunities` + nudge constant), idle nudge (Task 8), unstake-via-swap deep-link (Task 6), i18n 4 locales (Task 5), tests (Tasks 2,3,9,10). All spec sections map to a task.
- **Placeholder scan:** none — every code step contains complete code; the one empirical unknown (exchange-rate helper semantics) is handled by an explicit verification step (Task 4, Step 1) with a graceful `null` fallback, not a TODO.
- **Type consistency:** `idleStx`, `validateStakeAmount` (`StakeValidation` with `reason: "below-min" | "exceeds-balance"`), `estimateStStxReceived`, `buildStakeParams`/`StakeParams`, `stakeStx`, `fetchStxPerStStx` are used with identical signatures across tasks. `NotificationCategory: "wallet"` is a valid union member. `stxToMicro`/`microToSTX` are imported from `@/lib/dca` (same as `CreatePlanForm`).
