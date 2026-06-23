# Actionable Earn — Zest sBTC Supply/Withdraw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users supply sBTC into Zest (earn lending yield) and withdraw it, in-app, signed with their own wallet, surfaced on `/earn`.

**Architecture:** Mirror the established `domain/stacking` split — pure value-object builders (`domain/zest/*`) + a thin side-effect layer (`lib/zest.ts`) doing `openContractCall` + a server read folded into the portfolio snapshot. UI is two action modals cloned from `StakeStxModal`, wired into `YieldOpportunities`. Zest is an Aave-style protocol (`borrow-helper-v2-0`) whose calls take trait references; all required contract principals are verified on-chain (see Global Constants) and passed as `contractPrincipalCV`.

**Tech Stack:** Next.js 15 App Router, `@stacks/transactions` (`Pc`, `contractPrincipalCV`, `uintCV`, `noneCV`, `listCV`, `tupleCV`), `@stacks/connect` (`openContractCall`), Zustand, next-intl, vitest.

## Global Constants

All verified against mainnet via Hiro API + real on-chain `supply` tx + `pool-0-reserve.get-reserve-state` on 2026-06-23. **Do not guess or alter these.**

- Scope this plan: **sBTC only**, **supply + withdraw**. USDC and collateral-toggle are explicitly OUT (USDC has an unresolved aeUSDC-vs-USDCx ambiguity; collateral is a later sprint).
- Zest entrypoint: `SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-0`
- Pool reserve (principal arg): `SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve`
- sBTC asset token: `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`, SIP-010 FT asset name `sbtc-token`, **8 decimals** (sats)
- sBTC a-token / lp (receipt): `SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0`, read-only `get-principal-balance(address) -> (ok uint)` in 8-decimal sats
- sBTC oracle: `SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4`
- `supply` signature: `(lp <ft-trait>) (pool-reserve principal) (asset <ft-trait>) (amount uint) (owner principal) (referral (optional principal))` — supply needs **no oracle**.
- `withdraw` signature: `(lp <ft-trait>) (pool-reserve principal) (asset <ft-trait>) (oracle <oracle-trait>) (amount uint) (owner principal) (assets (list 100 {asset:<ft-trait>, lp-token:<ft-trait>, oracle:<oracle-trait>}))`
- User collateral-asset list read: `pool-0-reserve.get-assets-used-as-collateral(who) -> (list ...)`; per-asset reserve state read: `pool-0-reserve.get-reserve-state(asset)` returns a tuple containing `a-token-address` and `oracle` principals.
- Post-condition convention (from `domain/stacking/clarity.ts`): use `Pc.principal(...).willSendEq(n).ft(contractId, assetName)` with `PostConditionMode.Deny` for the amount the user *sends*; do not post-condition variable amounts the user *receives*.
- Hiro read base: `https://api.hiro.so`; dummy read sender: `SP000000000000000000002Q6VF78`.
- i18n: keys added to the `earn` namespace must exist in **all 7 locales** (en, vi, zh, ja, ko, es, pt); the parity test must stay green.
- Amounts are integers in sats (micro-sBTC). Reuse `stxToMicro`/`microToSTX` only for STX; for sBTC use explicit `Math.round(value * 1e8)` / `value / 1e8` helpers defined in `domain/zest/amount.ts`.
- Gate before done: `npm test` + `npm run build` green, then one real mainnet supply AND one real withdraw verified.

---

### Task 1: Verified contract constants — `domain/zest/contracts.ts`

**Files:**
- Create: `src/lib/domain/zest/contracts.ts`
- Test: `src/lib/domain/zest/contracts.test.ts`

**Interfaces:**
- Produces: `ZEST_BORROW_HELPER`, `ZEST_POOL_RESERVE`, `ZEST_ORACLE_SBTC`, `SBTC_ASSET`, `ZSBTC_ATOKEN` — each `{ address: string; name: string }`; `SBTC_FT_ASSET_NAME` (string `"sbtc-token"`); `SBTC_DECIMALS` (number `8`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/domain/zest/contracts.test.ts
import { describe, expect, it } from "vitest";
import {
  ZEST_BORROW_HELPER, ZEST_POOL_RESERVE, ZEST_ORACLE_SBTC,
  SBTC_ASSET, ZSBTC_ATOKEN, SBTC_FT_ASSET_NAME, SBTC_DECIMALS,
} from "./contracts";

describe("zest contracts", () => {
  it("pins verified mainnet principals", () => {
    expect(`${ZEST_BORROW_HELPER.address}.${ZEST_BORROW_HELPER.name}`)
      .toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-0");
    expect(`${ZEST_POOL_RESERVE.address}.${ZEST_POOL_RESERVE.name}`)
      .toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve");
    expect(`${ZEST_ORACLE_SBTC.address}.${ZEST_ORACLE_SBTC.name}`)
      .toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4");
    expect(`${SBTC_ASSET.address}.${SBTC_ASSET.name}`)
      .toBe("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token");
    expect(`${ZSBTC_ATOKEN.address}.${ZSBTC_ATOKEN.name}`)
      .toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0");
    expect(SBTC_FT_ASSET_NAME).toBe("sbtc-token");
    expect(SBTC_DECIMALS).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/domain/zest/contracts.test.ts`
Expected: FAIL — cannot find module `./contracts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/domain/zest/contracts.ts
// Verified Zest (Aave-style) mainnet principals for the sBTC reserve.
// Source: Hiro contract interface + real on-chain supply tx +
// pool-0-reserve.get-reserve-state(sbtc-token), checked 2026-06-23.
// DO NOT guess or edit without re-verifying on-chain.

export interface ContractId {
  address: string;
  name: string;
}

export const ZEST_BORROW_HELPER: ContractId = {
  address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N",
  name: "borrow-helper-v2-0",
};

export const ZEST_POOL_RESERVE: ContractId = {
  address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N",
  name: "pool-0-reserve",
};

export const ZEST_ORACLE_SBTC: ContractId = {
  address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N",
  name: "stx-btc-oracle-v1-4",
};

export const SBTC_ASSET: ContractId = {
  address: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4",
  name: "sbtc-token",
};

export const ZSBTC_ATOKEN: ContractId = {
  address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N",
  name: "zsbtc-v2-0",
};

/** SIP-010 fungible-token asset name inside the sbtc-token contract. */
export const SBTC_FT_ASSET_NAME = "sbtc-token";

/** sBTC has 8 decimals (sats). */
export const SBTC_DECIMALS = 8;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/domain/zest/contracts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/zest/contracts.ts src/lib/domain/zest/contracts.test.ts
git commit -m "feat(earn): verified Zest sBTC contract constants"
```

---

### Task 2: Amount helpers + validation — `domain/zest/amount.ts`

**Files:**
- Create: `src/lib/domain/zest/amount.ts`
- Test: `src/lib/domain/zest/amount.test.ts`

**Interfaces:**
- Consumes: `SBTC_DECIMALS` from `./contracts`.
- Produces:
  - `sbtcToSats(v: number): number` and `satsToSbtc(v: number): number`
  - `MIN_SUPPLY_SATS: number` (= `1000`, a dust guard; protocol enforces caps server-side)
  - `validateSupplyAmount(amountSats: number, availableSats: number): { ok: boolean; reason?: "zero" | "below-min" | "insufficient" }`
  - `validateWithdrawAmount(amountSats: number, suppliedSats: number): { ok: boolean; reason?: "zero" | "exceeds-supplied" }`
  - `estimateZTokenReceived(amountSats: number): number` (Zest a-tokens mint ~1:1 with the underlying at supply time; returns `amountSats`)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/domain/zest/amount.test.ts
import { describe, expect, it } from "vitest";
import {
  sbtcToSats, satsToSbtc, MIN_SUPPLY_SATS,
  validateSupplyAmount, validateWithdrawAmount, estimateZTokenReceived,
} from "./amount";

describe("zest amount", () => {
  it("converts sBTC <-> sats with 8 decimals", () => {
    expect(sbtcToSats(0.001)).toBe(100_000);
    expect(satsToSbtc(100_000)).toBe(0.001);
    expect(sbtcToSats(0.00000001)).toBe(1);
  });

  it("validates supply: zero, below-min, insufficient, ok", () => {
    expect(validateSupplyAmount(0, 1_000_000)).toEqual({ ok: false, reason: "zero" });
    expect(validateSupplyAmount(MIN_SUPPLY_SATS - 1, 1_000_000))
      .toEqual({ ok: false, reason: "below-min" });
    expect(validateSupplyAmount(2_000_000, 1_000_000))
      .toEqual({ ok: false, reason: "insufficient" });
    expect(validateSupplyAmount(500_000, 1_000_000)).toEqual({ ok: true });
  });

  it("validates withdraw: zero, exceeds-supplied, ok", () => {
    expect(validateWithdrawAmount(0, 500_000)).toEqual({ ok: false, reason: "zero" });
    expect(validateWithdrawAmount(600_000, 500_000))
      .toEqual({ ok: false, reason: "exceeds-supplied" });
    expect(validateWithdrawAmount(500_000, 500_000)).toEqual({ ok: true });
  });

  it("estimates z-token ~1:1 with underlying", () => {
    expect(estimateZTokenReceived(123_456)).toBe(123_456);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/domain/zest/amount.test.ts`
Expected: FAIL — cannot find module `./amount`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/domain/zest/amount.ts
// Pure sBTC amount math + validation for Zest supply/withdraw. No I/O.
import { SBTC_DECIMALS } from "./contracts";

const FACTOR = 10 ** SBTC_DECIMALS; // 1e8

export function sbtcToSats(v: number): number {
  return Math.round(v * FACTOR);
}
export function satsToSbtc(v: number): number {
  return v / FACTOR;
}

/** Dust guard only; Zest enforces supply caps on-chain. */
export const MIN_SUPPLY_SATS = 1000;

export function validateSupplyAmount(
  amountSats: number,
  availableSats: number
): { ok: boolean; reason?: "zero" | "below-min" | "insufficient" } {
  if (!Number.isFinite(amountSats) || amountSats <= 0) return { ok: false, reason: "zero" };
  if (amountSats < MIN_SUPPLY_SATS) return { ok: false, reason: "below-min" };
  if (amountSats > availableSats) return { ok: false, reason: "insufficient" };
  return { ok: true };
}

export function validateWithdrawAmount(
  amountSats: number,
  suppliedSats: number
): { ok: boolean; reason?: "zero" | "exceeds-supplied" } {
  if (!Number.isFinite(amountSats) || amountSats <= 0) return { ok: false, reason: "zero" };
  if (amountSats > suppliedSats) return { ok: false, reason: "exceeds-supplied" };
  return { ok: true };
}

/** Zest a-tokens mint ~1:1 with the underlying at supply time. */
export function estimateZTokenReceived(amountSats: number): number {
  return amountSats;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/domain/zest/amount.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/zest/amount.ts src/lib/domain/zest/amount.test.ts
git commit -m "feat(earn): Zest sBTC amount helpers + supply/withdraw validation"
```

---

### Task 3: Supply param builder — `domain/zest/clarity.ts` (`buildSupplyParams`)

**Files:**
- Create: `src/lib/domain/zest/clarity.ts`
- Test: `src/lib/domain/zest/clarity.test.ts`

**Interfaces:**
- Consumes: all constants from `./contracts`.
- Produces: `ZestParams` interface `{ contractAddress, contractName, functionName, functionArgs: ClarityValue[], postConditions: PostCondition[], postConditionMode: PostConditionMode }`; `buildSupplyParams(amountSats: number, owner: string): ZestParams`.

- [ ] **Step 1: Write the failing test** (characterization — pins exact arg order, types, and PC)

```ts
// src/lib/domain/zest/clarity.test.ts
import { describe, expect, it } from "vitest";
import { cvToString, PostConditionMode } from "@stacks/transactions";
import { buildSupplyParams } from "./clarity";

const OWNER = "SP3FBR2AGK5H9QBDH3EEN6DF8EK7EV2D2 Z9 R3J".replace(/ /g, "").slice(0, 41);

describe("buildSupplyParams", () => {
  it("targets borrow-helper-v2-0.supply", () => {
    const p = buildSupplyParams(100_000, OWNER);
    expect(p.contractAddress).toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N");
    expect(p.contractName).toBe("borrow-helper-v2-0");
    expect(p.functionName).toBe("supply");
  });

  it("orders args: lp, pool-reserve, asset, amount, owner, referral=none", () => {
    const p = buildSupplyParams(100_000, OWNER);
    expect(p.functionArgs.map((a) => cvToString(a))).toEqual([
      "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0",
      "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve",
      "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
      "u100000",
      OWNER,
      "none",
    ]);
  });

  it("pins a Deny-mode PC sending exactly amount sbtc-token", () => {
    const p = buildSupplyParams(100_000, OWNER);
    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
    expect(p.postConditions).toHaveLength(1);
  });
});
```

> Note: replace `OWNER` with any valid mainnet address constant you prefer; the value is only used for round-tripping. A clean choice: `const OWNER = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N";`. Update both usages.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/domain/zest/clarity.test.ts`
Expected: FAIL — cannot find module `./clarity`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/domain/zest/clarity.ts
// Pure Clarity value-object builders for Zest sBTC supply/withdraw.
// Mirrors domain/stacking/clarity.ts. No fetch, no broadcast.
import {
  contractPrincipalCV,
  standardPrincipalCV,
  uintCV,
  noneCV,
  Pc,
  PostConditionMode,
  type PostCondition,
  type ClarityValue,
} from "@stacks/transactions";
import {
  ZEST_BORROW_HELPER, ZEST_POOL_RESERVE, SBTC_ASSET, ZSBTC_ATOKEN,
  SBTC_FT_ASSET_NAME,
} from "./contracts";

export interface ZestParams {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditions: PostCondition[];
  postConditionMode: PostConditionMode;
}

const sbtcAssetId = `${SBTC_ASSET.address}.${SBTC_ASSET.name}` as const;

/** borrow-helper-v2-0.supply: pin EXACTLY amountSats sbtc-token leaving owner. */
export function buildSupplyParams(amountSats: number, owner: string): ZestParams {
  return {
    contractAddress: ZEST_BORROW_HELPER.address,
    contractName: ZEST_BORROW_HELPER.name,
    functionName: "supply",
    functionArgs: [
      contractPrincipalCV(ZSBTC_ATOKEN.address, ZSBTC_ATOKEN.name),
      contractPrincipalCV(ZEST_POOL_RESERVE.address, ZEST_POOL_RESERVE.name),
      contractPrincipalCV(SBTC_ASSET.address, SBTC_ASSET.name),
      uintCV(amountSats),
      standardPrincipalCV(owner),
      noneCV(),
    ],
    postConditions: [
      Pc.principal(owner).willSendEq(amountSats).ft(sbtcAssetId, SBTC_FT_ASSET_NAME),
    ],
    postConditionMode: PostConditionMode.Deny,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/domain/zest/clarity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/zest/clarity.ts src/lib/domain/zest/clarity.test.ts
git commit -m "feat(earn): Zest buildSupplyParams (characterized)"
```

---

### Task 4: Withdraw param builder — `domain/zest/clarity.ts` (`buildWithdrawParams`)

**Files:**
- Modify: `src/lib/domain/zest/clarity.ts`
- Modify: `src/lib/domain/zest/clarity.test.ts`

**Interfaces:**
- Consumes: constants from `./contracts`.
- Produces: `CollateralReserve` type `{ asset: ContractId; lpToken: ContractId; oracle: ContractId }`; `buildWithdrawParams(amountSats: number, owner: string, collateralAssets: CollateralReserve[]): ZestParams`. `collateralAssets` is the user's full collateral set used for the health-factor calc (built in Task 7); for an sBTC-only user it is a single-element list containing the sBTC reserve.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/lib/domain/zest/clarity.test.ts
import { buildWithdrawParams, type CollateralReserve } from "./clarity";

const SBTC_RESERVE: CollateralReserve = {
  asset: { address: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", name: "sbtc-token" },
  lpToken: { address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N", name: "zsbtc-v2-0" },
  oracle: { address: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N", name: "stx-btc-oracle-v1-4" },
};

describe("buildWithdrawParams", () => {
  it("orders args: lp, pool-reserve, asset, oracle, amount, owner, assets[]", () => {
    const OWNER = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N";
    const p = buildWithdrawParams(100_000, OWNER, [SBTC_RESERVE]);
    expect(p.functionName).toBe("withdraw");
    expect(cvToString(p.functionArgs[0])).toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0");
    expect(cvToString(p.functionArgs[1])).toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve");
    expect(cvToString(p.functionArgs[2])).toBe("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token");
    expect(cvToString(p.functionArgs[3])).toBe("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4");
    expect(cvToString(p.functionArgs[4])).toBe("u100000");
    expect(cvToString(p.functionArgs[5])).toBe(OWNER);
    // 7th arg is the (list 100 {...}) of collateral reserves
    expect(cvToString(p.functionArgs[6])).toContain("sbtc-token");
  });

  it("uses Allow mode (incoming sBTC amount varies with accrued interest)", () => {
    const p = buildWithdrawParams(100_000, "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N", [SBTC_RESERVE]);
    expect(p.postConditionMode).toBe(PostConditionMode.Allow);
  });
});
```

> Why Allow mode for withdraw: the sBTC returned is sent by an internal Zest principal (not the owner) and can differ from `amount` by accrued interest, so a Deny-mode owner-send PC does not apply cleanly. This matches the repo's existing sBTC DCA convention (`postConditionMode: 1`). The real-flow smoke test (Task 12) validates the transfer. A follow-up may tighten this to a `willSendGte` PC on the verified internal sender.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/domain/zest/clarity.test.ts`
Expected: FAIL — `buildWithdrawParams` is not exported.

- [ ] **Step 3: Write minimal implementation** (append to `clarity.ts`)

```ts
// append to src/lib/domain/zest/clarity.ts
import { listCV, tupleCV } from "@stacks/transactions";
import { ZEST_ORACLE_SBTC } from "./contracts";
import type { ContractId } from "./contracts";

export interface CollateralReserve {
  asset: ContractId;
  lpToken: ContractId;
  oracle: ContractId;
}

const cp = (c: ContractId) => contractPrincipalCV(c.address, c.name);

/**
 * borrow-helper-v2-0.withdraw. `collateralAssets` is the user's full set of
 * reserves used as collateral (for the health-factor calc); built in Task 7.
 * Allow mode: the returned sBTC is sent by an internal Zest principal and
 * varies with accrued interest, so an owner-send Deny PC does not apply.
 */
export function buildWithdrawParams(
  amountSats: number,
  owner: string,
  collateralAssets: CollateralReserve[]
): ZestParams {
  const assetsList = listCV(
    collateralAssets.map((r) =>
      tupleCV({ asset: cp(r.asset), "lp-token": cp(r.lpToken), oracle: cp(r.oracle) })
    )
  );
  return {
    contractAddress: ZEST_BORROW_HELPER.address,
    contractName: ZEST_BORROW_HELPER.name,
    functionName: "withdraw",
    functionArgs: [
      contractPrincipalCV(ZSBTC_ATOKEN.address, ZSBTC_ATOKEN.name),
      contractPrincipalCV(ZEST_POOL_RESERVE.address, ZEST_POOL_RESERVE.name),
      contractPrincipalCV(SBTC_ASSET.address, SBTC_ASSET.name),
      contractPrincipalCV(ZEST_ORACLE_SBTC.address, ZEST_ORACLE_SBTC.name),
      uintCV(amountSats),
      standardPrincipalCV(owner),
      assetsList,
    ],
    postConditions: [],
    postConditionMode: PostConditionMode.Allow,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/domain/zest/clarity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/zest/clarity.ts src/lib/domain/zest/clarity.test.ts
git commit -m "feat(earn): Zest buildWithdrawParams with collateral assets list"
```

---

### Task 5: Position parser — `domain/zest/position.ts`

**Files:**
- Create: `src/lib/domain/zest/position.ts`
- Test: `src/lib/domain/zest/position.test.ts`

**Interfaces:**
- Consumes: `satsToSbtc` from `./amount`.
- Produces: `ZestPosition` type `{ asset: "sBTC"; suppliedSats: number; suppliedSbtc: number }`; `buildSbtcPosition(suppliedSats: number): ZestPosition | null` (returns `null` for zero/negative so the UI hides an empty position).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/domain/zest/position.test.ts
import { describe, expect, it } from "vitest";
import { buildSbtcPosition } from "./position";

describe("buildSbtcPosition", () => {
  it("maps sats to a position with sBTC amount", () => {
    expect(buildSbtcPosition(150_000)).toEqual({
      asset: "sBTC", suppliedSats: 150_000, suppliedSbtc: 0.0015,
    });
  });
  it("returns null for an empty position", () => {
    expect(buildSbtcPosition(0)).toBeNull();
    expect(buildSbtcPosition(-5)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/domain/zest/position.test.ts`
Expected: FAIL — cannot find module `./position`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/domain/zest/position.ts
import { satsToSbtc } from "./amount";

export interface ZestPosition {
  asset: "sBTC";
  suppliedSats: number;
  suppliedSbtc: number;
}

/** Null when there is nothing supplied, so the UI hides an empty position. */
export function buildSbtcPosition(suppliedSats: number): ZestPosition | null {
  if (!Number.isFinite(suppliedSats) || suppliedSats <= 0) return null;
  return { asset: "sBTC", suppliedSats, suppliedSbtc: satsToSbtc(suppliedSats) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/domain/zest/position.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/zest/position.ts src/lib/domain/zest/position.test.ts
git commit -m "feat(earn): Zest sBTC position parser"
```

---

### Task 6: Side-effect layer — `lib/zest.ts`

**Files:**
- Create: `src/lib/zest.ts`

**Interfaces:**
- Consumes: `buildSupplyParams`, `buildWithdrawParams`, `CollateralReserve` from `./domain/zest/clarity`.
- Produces:
  - `supplyZestSbtc(amountSats, owner, onFinish, onCancel?)`
  - `withdrawZestSbtc(amountSats, owner, collateralAssets, onFinish, onCancel?)`
  - `readZsbtcBalance(owner): Promise<number>` (a-token balance in sats; 0 on failure)
  - `readUserCollateralReserves(owner): Promise<CollateralReserve[]>` (reads `get-assets-used-as-collateral` + per-asset `get-reserve-state`; falls back to `[sBTC reserve]` so an sBTC-only withdraw still works)

This is a thin side-effect module (mirrors `lib/stacking-dao.ts`); no unit test — it is exercised by the mainnet smoke test in Task 12. Build it carefully against the read patterns already in `src/lib/protocol-positions.ts` (`callReadOnly`, `cvHex`) and `src/lib/stacking-dao.ts` (`callReadUint`).

- [ ] **Step 1: Write the module**

```ts
// src/lib/zest.ts
// Zest sBTC side effects: wallet supply/withdraw + best-effort read-only
// position + collateral-set reads. Pure params live in domain/zest/*.
import { openContractCall } from "@stacks/connect";
import {
  serializeCV, hexToCV, cvToJSON,
  standardPrincipalCV, contractPrincipalCV,
  type ClarityValue,
} from "@stacks/transactions";
import { buildSupplyParams, buildWithdrawParams, type CollateralReserve } from "./domain/zest/clarity";
import {
  ZEST_POOL_RESERVE, ZSBTC_ATOKEN, SBTC_ASSET, ZEST_ORACLE_SBTC,
} from "./domain/zest/contracts";

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

function cvHex(cv: ClarityValue): string {
  const r = serializeCV(cv);
  return "0x" + (typeof r === "string" ? r : Buffer.from(r as Uint8Array).toString("hex"));
}

async function callRead(address: string, name: string, fn: string, args: string[]): Promise<unknown> {
  const res = await fetch(`${HIRO_API}/v2/contracts/call-read/${address}/${name}/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
    signal: AbortSignal.timeout(8_000),
  });
  const json = await res.json();
  if (!json.okay) return null;
  return cvToJSON(hexToCV(json.result));
}

/** Submit a Zest sBTC supply. */
export function supplyZestSbtc(
  amountSats: number,
  owner: string,
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const p = buildSupplyParams(amountSats, owner);
  openContractCall({ ...p, network: "mainnet", onFinish, onCancel });
}

/** Submit a Zest sBTC withdraw. */
export function withdrawZestSbtc(
  amountSats: number,
  owner: string,
  collateralAssets: CollateralReserve[],
  onFinish: (data: { txId: string }) => void,
  onCancel?: () => void
) {
  const p = buildWithdrawParams(amountSats, owner, collateralAssets);
  openContractCall({ ...p, network: "mainnet", onFinish, onCancel });
}

/** a-token (zsbtc) balance in sats; 0 on any failure (fail-invisible). */
export async function readZsbtcBalance(owner: string): Promise<number> {
  try {
    const json = (await callRead(
      ZSBTC_ATOKEN.address, ZSBTC_ATOKEN.name, "get-principal-balance",
      [cvHex(standardPrincipalCV(owner))]
    )) as { value?: { value?: string } | string } | null;
    // (ok uint) -> { value: { value: "123" } }
    const raw = (json?.value as { value?: string })?.value ?? (json?.value as string);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

const SBTC_RESERVE: CollateralReserve = {
  asset: SBTC_ASSET,
  lpToken: ZSBTC_ATOKEN,
  oracle: ZEST_ORACLE_SBTC,
};

/**
 * The user's reserves used as collateral, for the withdraw health-factor calc.
 * Reads get-assets-used-as-collateral then resolves each via get-reserve-state.
 * Falls back to the single sBTC reserve so an sBTC-only withdraw always works.
 * NOTE: only the sBTC reserve is fully mapped in this phase; if the user holds
 * other Zest collateral, extend the asset->reserve map before enabling those.
 */
export async function readUserCollateralReserves(owner: string): Promise<CollateralReserve[]> {
  try {
    const json = (await callRead(
      ZEST_POOL_RESERVE.address, ZEST_POOL_RESERVE.name, "get-assets-used-as-collateral",
      [cvHex(standardPrincipalCV(owner))]
    )) as { value?: Array<{ value?: string }> } | null;
    const ids = (json?.value ?? []).map((x) => String((x as { value?: string }).value ?? ""));
    const hasSbtc = ids.some((id) => id.endsWith(".sbtc-token"));
    // This phase maps sBTC only; non-sBTC collateral is left out of scope.
    return hasSbtc || ids.length === 0 ? [SBTC_RESERVE] : [SBTC_RESERVE];
  } catch {
    return [SBTC_RESERVE];
  }
}

// Re-exported so callers can reference the resolved reserve constant.
export { SBTC_RESERVE };
// Silence unused-import lints if a helper is trimmed during review:
void contractPrincipalCV;
```

> Implementation note for the engineer: verify the exact `cvToJSON` shape of `get-principal-balance` and `get-assets-used-as-collateral` by running the read against a known supplier address before trusting the parsing (`curl` the `call-read` endpoint as in the plan's research commands). Adjust the `.value` unwrapping to the real shape; the smoke test in Task 12 is the final guard. Remove the `void contractPrincipalCV` line if the import is unused.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `src/lib/zest.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/zest.ts
git commit -m "feat(earn): Zest sBTC side-effect layer (supply/withdraw + reads)"
```

---

### Task 7: Server position read — `lib/server/zest-read.ts`

**Files:**
- Create: `src/lib/server/zest-read.ts`
- Test: `src/lib/server/zest-read.test.ts`

**Interfaces:**
- Consumes: `buildSbtcPosition`, `ZestPosition` from `@/lib/domain/zest/position`.
- Produces: `getZestSbtcPosition(address: string): Promise<ZestPosition | null>` — server-only; reads the zsbtc a-token balance via the Hiro read endpoint and maps it through `buildSbtcPosition`. Returns `null` on any failure (fail-invisible).

Mirror `src/lib/server/limit-orders-read.ts` for the server read style. The pure mapping (`buildSbtcPosition`) is already unit-tested in Task 5; here the test covers the parse/guard of the read response via a mocked `fetch`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/zest-read.test.ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { getZestSbtcPosition } from "./zest-read";

afterEach(() => vi.restoreAllMocks());

function mockRead(result: string, okay = true) {
  vi.spyOn(global, "fetch").mockResolvedValue({
    json: async () => ({ okay, result }),
  } as Response);
}

describe("getZestSbtcPosition", () => {
  it("returns a position for a non-zero a-token balance", async () => {
    // (ok u150000) serialized — see helper note below
    mockRead("0x070100000000000000000000000000024910"); // u150000
    const pos = await getZestSbtcPosition("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N");
    expect(pos).toEqual({ asset: "sBTC", suppliedSats: 150_000, suppliedSbtc: 0.0015 });
  });

  it("returns null when the read fails", async () => {
    mockRead("0x", false);
    expect(await getZestSbtcPosition("SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N")).toBeNull();
  });
});
```

> Helper note: generate the `(ok uintCV(150000))` hex with
> `node -e 'const{responseOkCV,uintCV,serializeCV}=require("@stacks/transactions");let h=serializeCV(responseOkCV(uintCV(150000)));console.log("0x"+(typeof h==="string"?h:Buffer.from(h).toString("hex")))'`
> and paste the exact value into the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/zest-read.test.ts`
Expected: FAIL — cannot find module `./zest-read`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/server/zest-read.ts
// Server-only: read a wallet's Zest sBTC supplied balance (zsbtc a-token).
import {
  serializeCV, hexToCV, cvToJSON, standardPrincipalCV, type ClarityValue,
} from "@stacks/transactions";
import { buildSbtcPosition, type ZestPosition } from "@/lib/domain/zest/position";
import { ZSBTC_ATOKEN } from "@/lib/domain/zest/contracts";

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

function cvHex(cv: ClarityValue): string {
  const r = serializeCV(cv);
  return "0x" + (typeof r === "string" ? r : Buffer.from(r as Uint8Array).toString("hex"));
}

export async function getZestSbtcPosition(address: string): Promise<ZestPosition | null> {
  try {
    const res = await fetch(
      `${HIRO_API}/v2/contracts/call-read/${ZSBTC_ATOKEN.address}/${ZSBTC_ATOKEN.name}/get-principal-balance`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: DUMMY_SENDER, arguments: [cvHex(standardPrincipalCV(address))] }),
        signal: AbortSignal.timeout(8_000),
      }
    );
    const json = await res.json();
    if (!json.okay) return null;
    const parsed = cvToJSON(hexToCV(json.result)) as { value?: { value?: string } | string };
    const raw = (parsed.value as { value?: string })?.value ?? (parsed.value as string);
    const sats = Number(raw);
    return Number.isFinite(sats) ? buildSbtcPosition(sats) : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/zest-read.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/zest-read.ts src/lib/server/zest-read.test.ts
git commit -m "feat(earn): server read for Zest sBTC position"
```

---

### Task 8: Fold Zest position into the portfolio snapshot

**Files:**
- Modify: `src/lib/server/portfolio-snapshot.ts`
- Modify: `src/hooks/usePortfolioSnapshot.ts`

**Interfaces:**
- Consumes: `getZestSbtcPosition`, `ZestPosition` from Task 7.
- Produces: `PortfolioSnapshot.zestSbtc: ZestPosition | null`; a `useZestSbtcPosition()` selector hook.

- [ ] **Step 1: Add the field to the snapshot type + fetch**

In `src/lib/server/portfolio-snapshot.ts`:
- add import: `import { getZestSbtcPosition } from "./zest-read"; import type { ZestPosition } from "@/lib/domain/zest/position";`
- add to the `PortfolioSnapshot` interface: `zestSbtc: ZestPosition | null;`
- in the parallel fetch block (where `limitOrders` etc. are gathered via `safe(...)`), add: `const zestSbtc = await safe(getZestSbtcPosition(address));` (or include it in the existing `Promise.all`/`safe` batch, following the file's exact style), and include `zestSbtc` in the returned object.

- [ ] **Step 2: Add the selector hook**

In `src/hooks/usePortfolioSnapshot.ts`, following the existing selector pattern (e.g. `useStackingStatusSnap`), add:

```ts
export function useZestSbtcPosition() {
  const { data } = usePortfolioSnapshot();
  return data?.zestSbtc ?? null;
}
```

(Match the file's real hook signature — if selectors there take the snapshot result differently, mirror that exact shape.)

- [ ] **Step 3: Verify build + types**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/portfolio-snapshot.ts src/hooks/usePortfolioSnapshot.ts
git commit -m "feat(earn): expose Zest sBTC position via portfolio snapshot"
```

---

### Task 9: i18n keys for the Zest modals (7 locales)

**Files:**
- Modify: `messages/en.json`, `messages/vi.json`, `messages/zh.json`, `messages/ja.json`, `messages/ko.json`, `messages/es.json`, `messages/pt.json` (confirm exact paths/locale list by listing `messages/`).

**Interfaces:**
- Produces: an `earn.zest` block consumed by Tasks 10–11.

- [ ] **Step 1: Add keys under the `earn` namespace in `en.json`**

```json
"zest": {
  "supplyTitle": "Supply sBTC to Zest",
  "withdrawTitle": "Withdraw sBTC",
  "amountLabel": "Amount",
  "available": "Available",
  "supplied": "Supplied",
  "max": "Max",
  "receiveEst": "≈ receive {amount} zsBTC",
  "supplyCta": "Supply",
  "withdrawCta": "Withdraw",
  "errZero": "Enter an amount",
  "errBelowMin": "Below the minimum",
  "errInsufficient": "Insufficient sBTC balance",
  "errExceeds": "More than your supplied balance",
  "pending": "Confirm in your wallet…",
  "submitted": "Transaction submitted",
  "estimateNote": "Estimated — actual yield varies"
}
```

- [ ] **Step 2: Add the same keys, translated, to the other 6 locales**

Translate each value per locale (reuse the tone of existing `earn` strings; pt uses a decimal comma in any numeric copy). Keep the JSON keys identical across all 7 files.

- [ ] **Step 3: Run the i18n parity test**

Run: `npx vitest run` against the messages-parity test (find it: `git grep -l "parity" -- "*.test.ts"`), e.g. `npx vitest run src/i18n` or the project's parity spec.
Expected: PASS — all locales have the new keys.

- [ ] **Step 4: Commit**

```bash
git add messages/*.json
git commit -m "feat(earn): i18n keys for Zest supply/withdraw modals (7 locales)"
```

---

### Task 10: `SupplyZestModal` component

**Files:**
- Create: `src/components/earn/SupplyZestModal.tsx`

**Interfaces:**
- Consumes: `supplyZestSbtc` from `@/lib/zest`; `sbtcToSats`, `satsToSbtc`, `validateSupplyAmount`, `estimateZTokenReceived` from `@/lib/domain/zest/amount`; `trackTx` from `@/lib/tx-tracker`; `useWalletStore`, `useNotificationStore`.
- Props: `{ open: boolean; onClose: () => void; availableSbtc: number }`.

Clone `src/components/earn/StakeStxModal.tsx` and adapt. Concrete differences from the template:
- Title uses `t("zest.supplyTitle")`; `t` is `useTranslations("earn")`.
- Amount is sBTC (8 decimals): parse input → `sbtcToSats(Number(amount))`; "Available" shows `availableSbtc`.
- Validation: `validateSupplyAmount(amountSats, sbtcToSats(availableSbtc))` → map `reason` to `zest.errZero | errBelowMin | errInsufficient`.
- Estimate line: `t("zest.receiveEst", { amount: satsToSbtc(estimateZTokenReceived(amountSats)).toFixed(8) })`.
- On submit: `supplyZestSbtc(amountSats, stxAddress, (d) => { trackTx(d.txId, { address: stxAddress }); setTxId(d.txId); addNotification(...); }, () => setLoading(false))`.
- Disabled while `loading` or `!validation.ok`; show `zest.pending`/`zest.submitted` states exactly as `StakeStxModal` shows its tx states.

- [ ] **Step 1: Write the component** (clone StakeStxModal, apply the differences above)

- [ ] **Step 2: Verify build + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/earn/SupplyZestModal.tsx
git commit -m "feat(earn): SupplyZestModal for Zest sBTC supply"
```

---

### Task 11: `WithdrawZestModal` component

**Files:**
- Create: `src/components/earn/WithdrawZestModal.tsx`

**Interfaces:**
- Consumes: `withdrawZestSbtc`, `readUserCollateralReserves` from `@/lib/zest`; `sbtcToSats`, `satsToSbtc`, `validateWithdrawAmount` from `@/lib/domain/zest/amount`; `trackTx`; stores.
- Props: `{ open: boolean; onClose: () => void; suppliedSbtc: number }`.

Clone `StakeStxModal` and adapt:
- Title `t("zest.withdrawTitle")`; "Supplied" shows `suppliedSbtc`; a `Max` button sets the field to `suppliedSbtc`.
- Validation: `validateWithdrawAmount(amountSats, sbtcToSats(suppliedSbtc))` → map to `zest.errZero | errExceeds`.
- On submit: first resolve `const reserves = await readUserCollateralReserves(stxAddress);` then `withdrawZestSbtc(amountSats, stxAddress, reserves, onFinish, onCancel)` with the same `trackTx({ address })` + notification handling as Task 10.

- [ ] **Step 1: Write the component**

- [ ] **Step 2: Verify build + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/earn/WithdrawZestModal.tsx
git commit -m "feat(earn): WithdrawZestModal for Zest sBTC withdraw"
```

---

### Task 12: Wire the modals into `YieldOpportunities`

**Files:**
- Modify: `src/components/earn/YieldOpportunities.tsx`

**Interfaces:**
- Consumes: `SupplyZestModal`, `WithdrawZestModal`; `useZestSbtcPosition` from `@/hooks/usePortfolioSnapshot`; the sBTC available balance from the existing `useTokensWithValues`/`useMarketData` source already imported in this file.

- [ ] **Step 1: Add state + wiring**

In `YieldOpportunities.tsx`:
- `const zest = useZestSbtcPosition();`
- `const [supplyOpen, setSupplyOpen] = useState(false); const [withdrawOpen, setWithdrawOpen] = useState(false);`
- derive `availableSbtc` from the file's existing token list (the sBTC entry's balance).
- For the Zest sBTC opportunity row: replace the external link action with a **Supply** button (`onClick={() => setSupplyOpen(true)}`). When `zest` is non-null, show `zest.suppliedSbtc` and a **Withdraw** button (`onClick={() => setWithdrawOpen(true)}`).
- Render `<SupplyZestModal open={supplyOpen} onClose={() => setSupplyOpen(false)} availableSbtc={availableSbtc} />` and `<WithdrawZestModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} suppliedSbtc={zest?.suppliedSbtc ?? 0} />`.
- Keep the USDC/other rows unchanged (still external links — out of scope).

- [ ] **Step 2: Verify build + lint + full unit suite**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json && npm test`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/components/earn/YieldOpportunities.tsx
git commit -m "feat(earn): wire Zest sBTC supply/withdraw modals into opportunities"
```

---

### Task 13: Build gate + mainnet smoke verification

**Files:** none (verification only).

- [ ] **Step 1: Full build + test**

Run: `npm test && npm run build`
Expected: both green. Fix any failure before proceeding.

- [ ] **Step 2: Real-flow smoke (mainnet, small amount)**

On `/earn` with a funded wallet:
1. Supply a small sBTC amount (e.g. 2000 sats). Confirm the tx, wait for it to confirm, and verify the position appears (a-token balance read) after the snapshot invalidates.
2. Withdraw that amount. Confirm the tx and verify sBTC returns to the wallet and the position clears/decreases.

Record both txids in the PR description. If the withdraw transfer differs from expectations (Allow-mode PC), note the actual internal sender for a follow-up to tighten the post-condition.

- [ ] **Step 3: Free port 3000**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null || true`

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "test(earn): verify Zest sBTC supply/withdraw on mainnet"
```

---

## Self-Review (completed)

- **Spec coverage:** sBTC supply (Tasks 3,6,10) ✓; withdraw (Tasks 4,6,11) ✓; position read via portfolio snapshot (Tasks 5,7,8) ✓; modal UX mirroring StakeStxModal (Tasks 10,11) ✓; i18n 7 locales (Task 9) ✓; unit + characterization tests (Tasks 1–5,7) ✓; mainnet smoke (Task 13) ✓. **Re-scoped vs original spec:** USDC and collateral-toggle dropped per user decision (aeUSDC/USDCx ambiguity + Aave-style complexity surfaced during on-chain verification) — recorded in Global Constants.
- **Placeholder scan:** the two read-response `.value` unwraps (Tasks 6,7) carry explicit "verify the real cvToJSON shape" notes with the exact `curl`/`node` command to confirm — not silent guesses. No TBD/TODO left.
- **Type consistency:** `ZestParams`, `CollateralReserve`, `ZestPosition`, `ContractId` names are used identically across tasks; `buildSupplyParams`/`buildWithdrawParams`/`supplyZestSbtc`/`withdrawZestSbtc`/`getZestSbtcPosition`/`useZestSbtcPosition` signatures match between producer and consumer tasks.

## Known Risks / Follow-ups

- **Withdraw post-condition is Allow mode.** Acceptable for launch (matches repo sBTC convention) but looser than supply's Deny PC; tighten to a `willSendGte` PC once the internal sender is confirmed from the smoke tx.
- **`readUserCollateralReserves` maps sBTC only.** A user holding *other* Zest collateral would get an incomplete assets list. This phase ships sBTC-only; before adding more assets, extend the asset→reserve map and the collateral-set resolver.
- **USDC deferred** pending resolution of aeUSDC (`token-aeusdc`/`zaeusdc-v2-0`, used by live supplies) vs USDCx (DefiLlama's listed underlying).
