# STX → USDCx DCA-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users schedule recurring sells of STX into USDCx (a non-custodial DCA-out), mirroring the already-shipped sBTC→USDCx DCA-out one direction over.

**Architecture:** Deploy a dedicated STX→USDCx vault (byte-identical to `dca-vault-v2`), a new `swap-stx-for-token` router that routes STX→aeUSDC→USDCx, and a `batch-dca-executor-v2` that adds `vault-type 2` binding (new vault + new router) while keeping types 0/1 unchanged. The keeper scans the third vault via the SDK's `contractName` override; the frontend adds a source-asset toggle (sBTC/STX) inside the existing DCA-out tab.

**Tech Stack:** Clarity 3 (Clarinet), Node/TypeScript keeper (`@stacksport/dca-sdk`), Next.js 15 + React + next-intl, Vitest, Playwright.

**Commit discipline:** Per user preference, commit at fine granularity — RED (failing test) and GREEN (impl) as separate commits, helper code separate from wiring; every commit must build/test green. No `Co-Authored-By` trailer. Commit directly on `main`.

---

## File map

**Contracts (new):**
- `contracts/bitflow-usdcx-from-stx-router.clar` — `swap-stx-for-token`: STX→aeUSDC→USDCx, forwards USDCx to recipient.
- `contracts/dca-vault-stx-usdcx.clar` — STX-source vault, verbatim copy of `dca-vault-v2.clar`.
- `contracts/batch-dca-executor-v2.clar` — adds `vault-type u2` → (new vault, new router); keeps 0/1.
- `contracts/tests/*` — clarinet tests for the three above (mirror existing test files).

**Keeper (modify):**
- `keeper-bot/src/config.ts` — add `stxUsdcxVaultContract`; default `batchExecutorContract` → v2.
- `keeper-bot/src/batch-executor.ts` — widen `vaultType` to `0 | 1 | 2`.
- `keeper-bot/src/stacks-client.ts` — third `DCAVault` instance + scan it.
- `keeper-bot/src/dca-push.ts` — push copy for STX→USDCx.

**Frontend (new/modify):**
- `src/lib/dca-contracts.ts` — add STX→USDCx contract ids (modify).
- `src/lib/dca-stx-usdcx.ts` — lib mirror of `dca-sbtc.ts` in STX units (new).
- `src/lib/dca-stx-usdcx.test.ts` — unit tests (new).
- `src/components/dca-out/` — source toggle + STX variants of form/list/card/history (new + modify).
- `src/components/dca/DCAPageContent.tsx` — render source toggle in `out` tab (modify).
- `src/components/dca/performance/DCAOutPanel.tsx` — include STX-out source (modify).
- `messages/en/dca.json`, `messages/vi/dca.json` — new i18n keys (modify).
- `e2e/` — create-STX-out-plan case (new/modify).

---

## Phase 0 — Verification gate

### Task 0: Verify on-chain pool + asset identifiers

**Files:** none (investigation only — HARD GATE before writing the router).

- [ ] **Step 1: Verify the STX→aeUSDC pool contract exists**

Run:
```bash
curl -s "https://api.hiro.so/v2/contracts/interface/SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR/xyk-pool-stx-aeusdc-v-1-2" | head -c 300
```
Expected: a JSON contract interface (not `{"error":...}`). Confirms `POOL-STX-AEUSDC` is real.

- [ ] **Step 2: Verify the aeUSDC→USDCx stableswap pool exists**

Run:
```bash
curl -s "https://api.hiro.so/v2/contracts/interface/SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR/stableswap-pool-aeusdc-usdcx-v-1-1" | head -c 300
```
Expected: JSON contract interface.

- [ ] **Step 3: Verify token asset names (aeUSDC, USDCx)**

Run:
```bash
curl -s "https://api.hiro.so/v2/contracts/interface/SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K/token-aeusdc" | grep -o '"fungible_tokens":\[[^]]*\]'
curl -s "https://api.hiro.so/v2/contracts/interface/SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE/usdcx" | grep -o '"fungible_tokens":\[[^]]*\]'
```
Expected: both return their SIP-010 fungible-token definitions. These IDs already back the live sBTC→USDCx router (`contracts/bitflow-usdcx-swap-router.clar`), so they should all resolve. If any errors, STOP and reconcile before continuing.

- [ ] **Step 4: Commit a note (no code yet)** — skip; this task produces no artifact. Proceed to Task 1.

---

## Phase 1 — Smart contracts

### Task 1: STX→USDCx swap router

**Files:**
- Create: `contracts/bitflow-usdcx-from-stx-router.clar`
- Modify: `contracts/Clarinet.toml` (register the new contract)
- Test: `contracts/tests/bitflow-usdcx-from-stx-router.test.ts` (or `.clar` test per project convention — see Step 4)

- [ ] **Step 1: Write the router contract**

The vault transfers native STX to this router, which swaps STX→aeUSDC (xyk) then aeUSDC→USDCx (stableswap) and forwards USDCx to `recipient`. Trait + STX-in structure copied from `bitflow-sbtc-swap-router.clar`; hops copied from hops 2–3 of `bitflow-usdcx-swap-router.clar`.

```clarity
;; bitflow-usdcx-from-stx-router.clar
;; DCA Swap Router: STX -> aeUSDC -> USDCx via Bitflow
;;
;; Flow (2 hops):
;;   1. dca-vault-stx-usdcx transfers STX to this contract
;;   2. Hop 1: xyk-core swap-x-for-y on pool-stx-aeusdc (x=wSTX -> y=aeUSDC)
;;   3. Hop 2: stableswap-core swap-x-for-y on pool-aeusdc-usdcx (x=aeUSDC -> y=USDCx)
;;   4. USDCx forwarded to recipient

(use-trait dca-swap-trait  .dca-vault-stx-usdcx.dca-swap-trait)
(use-trait sip-010-trait   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(use-trait xyk-pool-trait  'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-trait-v-1-2.xyk-pool-trait)
(use-trait ss-pool-trait   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-trait-v-1-4.stableswap-pool-trait)

(impl-trait .dca-vault-stx-usdcx.dca-swap-trait)

;; Cores
(define-constant XYK-CORE 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2)
(define-constant SS-CORE  'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-4)

;; Pools
(define-constant POOL-STX-AEUSDC   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-2)
(define-constant POOL-AEUSDC-USDCX 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-aeusdc-usdcx-v-1-1)

;; Tokens
(define-constant WSTX   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2)
(define-constant AEUSDC 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc)
(define-constant USDCX  'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx)

;; swap-stx-for-token
;;   amount-in      - uSTX received from vault (6 decimals)
;;   min-amount-out - minimum USDCx to receive
;;   recipient      - plan owner, receives USDCx
(define-public (swap-stx-for-token
    (amount-in      uint)
    (min-amount-out uint)
    (recipient      principal))
  (let (
    ;; Hop 1: STX -> aeUSDC via xyk-pool-stx-aeusdc (x=wSTX -> y=aeUSDC)
    (dy-aeusdc (try! (as-contract
                       (contract-call?
                         'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
                         swap-x-for-y
                         'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-2
                         'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
                         'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
                         amount-in
                         u1))))

    ;; Hop 2: aeUSDC -> USDCx via stableswap-pool-aeusdc-usdcx (x=aeUSDC -> y=USDCx)
    (dy-usdcx (try! (as-contract
                      (contract-call?
                        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-4
                        swap-x-for-y
                        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-aeusdc-usdcx-v-1-1
                        'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
                        'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
                        dy-aeusdc
                        min-amount-out))))
  )
    ;; Forward USDCx from this contract to plan owner
    (try! (as-contract
            (contract-call?
              'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
              transfer dy-usdcx tx-sender recipient none)))
    (ok dy-usdcx)))
```

> NOTE: `swap-x-for-y` direction matches the live sBTC→USDCx router — pool `xyk-pool-stx-aeusdc` has x=wSTX/y=aeUSDC, and `stableswap-pool-aeusdc-usdcx` has x=aeUSDC/y=USDCx. This is the exact direction already used in `contracts/bitflow-usdcx-swap-router.clar` hops 2–3.

- [ ] **Step 2: Register both new contracts in Clarinet.toml**

Open `contracts/Clarinet.toml`. After the existing `[contracts.bitflow-usdcx-swap-router]` block, add (the vault is created in Task 2 but register both now so `clarinet check` resolves the `.dca-vault-stx-usdcx` trait reference):

```toml
[contracts.dca-vault-stx-usdcx]
path = "contracts/dca-vault-stx-usdcx.clar"
clarity_version = 3
epoch = 3.0

[contracts.bitflow-usdcx-from-stx-router]
path = "contracts/bitflow-usdcx-from-stx-router.clar"
clarity_version = 3
epoch = 3.0
```
(Match `clarity_version`/`epoch` to the values used by the existing router/vault blocks in this same file — copy them verbatim if they differ.)

- [ ] **Step 3: Create the vault file now so the trait reference resolves**

Copy `contracts/dca-vault-v2.clar` to `contracts/dca-vault-stx-usdcx.clar` verbatim (it is generic over target token + router; no code change needed):
```bash
cp contracts/dca-vault-v2.clar contracts/dca-vault-stx-usdcx.clar
```
Then change only the header comment on line 1 to:
```clarity
;; dca-vault-stx-usdcx: Dollar-Cost Averaging vault selling STX into USDCx
```

- [ ] **Step 4: Run clarinet check**

Run: `cd contracts && clarinet check`
Expected: PASS — all contracts (including the two new ones) type-check, no unresolved trait/contract references.

- [ ] **Step 5: Write a clarinet test for the router**

Inspect the existing router/vault test under `contracts/tests/` to match the project's test harness (Vitest + `@hirosystems/clarinet-sdk`, or `.clar` unit tests — use whichever the repo already uses). Write a test that asserts: calling `bitflow-usdcx-from-stx-router.swap-stx-for-token` is unreachable directly without funds (returns the expected swap error), and a mainnet-fork/simnet test if the harness supports it. At minimum mirror the assertions in the existing `bitflow-usdcx-swap-router` test file one-for-one, swapping sBTC-in for STX-in.

Run: `cd contracts && clarinet test` (or `npm test` in `contracts/` if Vitest-based)
Expected: the new router test PASSES.

- [ ] **Step 6: Commit**

```bash
git add contracts/bitflow-usdcx-from-stx-router.clar contracts/dca-vault-stx-usdcx.clar contracts/Clarinet.toml contracts/tests/
git commit -m "feat(contracts): STX→USDCx swap router + STX-USDCx vault"
```

### Task 2: batch-dca-executor-v2

**Files:**
- Create: `contracts/batch-dca-executor-v2.clar`
- Modify: `contracts/Clarinet.toml`
- Test: `contracts/tests/batch-dca-executor-v2.test.ts`

- [ ] **Step 1: Write the v2 batch executor**

Copy of `contracts/batch-dca-executor.clar` with a third branch for `vault-type u2`. Note vault-type 0 still points at the live `dca-vault` (v1) exactly as the current executor does — do not change it.

```clarity
;; batch-dca-executor-v2.clar
;; Orchestrates multiple DCA executions in a single transaction.
;; v2: adds vault-type u2 (STX -> USDCx). Existing vaults are NOT modified.

(define-constant MAX-BATCH u50)
(define-constant MIN-AMOUNT-OUT u1)

;; vault-type = u0: STX -> sBTC
(define-constant VAULT-STX
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault)
(define-constant ROUTER-STX
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router)

;; vault-type = u1: sBTC -> USDCx
(define-constant VAULT-SBTC
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2)
(define-constant ROUTER-SBTC
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-usdcx-swap-router)

;; vault-type = u2: STX -> USDCx
(define-constant VAULT-STX-USDCX
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-stx-usdcx)
(define-constant ROUTER-STX-USDCX
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-usdcx-from-stx-router)

(define-constant ERR-EMPTY-LIST (err u100))

(define-private (execute-single
    (item { plan-id: uint, vault-type: uint })
    (acc  { success: uint, failed: uint }))
  (let ((result
    (if (is-eq (get vault-type item) u0)
      (contract-call? VAULT-STX execute-dca
        (get plan-id item) ROUTER-STX MIN-AMOUNT-OUT)
      (if (is-eq (get vault-type item) u1)
        (contract-call? VAULT-SBTC execute-dca
          (get plan-id item) ROUTER-SBTC MIN-AMOUNT-OUT)
        (contract-call? VAULT-STX-USDCX execute-dca
          (get plan-id item) ROUTER-STX-USDCX MIN-AMOUNT-OUT))
    )))
  (match result
    ok-val  { success: (+ (get success acc) u1), failed: (get failed acc) }
    err-val { success: (get success acc), failed: (+ (get failed acc) u1) }
  ))
)

(define-read-only (get-max-batch)
  (ok MAX-BATCH))

(define-public (batch-execute-dca
    (plans (list 50 { plan-id: uint, vault-type: uint })))
  (begin
    (asserts! (> (len plans) u0) ERR-EMPTY-LIST)
    (ok (fold execute-single plans { success: u0, failed: u0 }))
  )
)
```

> NOTE: All three vault constants reference the on-chain deployer address `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV`. The new vault + router must be deployed by that same principal (Task 3) so these constants resolve post-deploy.

- [ ] **Step 2: Register in Clarinet.toml**

Add:
```toml
[contracts.batch-dca-executor-v2]
path = "contracts/batch-dca-executor-v2.clar"
clarity_version = 3
epoch = 3.0
```

- [ ] **Step 3: clarinet check**

Run: `cd contracts && clarinet check`
Expected: PASS.

- [ ] **Step 4: Write the batch executor test**

Mirror `contracts/tests/` test for `batch-dca-executor`. Assert: empty list → `ERR-EMPTY-LIST (err u100)`; a list with a `vault-type u2` item routes to `VAULT-STX-USDCX` (in simnet this may surface as a `failed` count when the plan does not exist — assert it does NOT revert the whole fold, i.e. `(ok { success: ..., failed: ... })` is returned). Mirror the existing "one failing plan doesn't revert the batch" assertion with a `u2` entry.

Run: `cd contracts && clarinet test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/batch-dca-executor-v2.clar contracts/Clarinet.toml contracts/tests/
git commit -m "feat(contracts): batch-dca-executor-v2 adds vault-type 2 (STX→USDCx)"
```

### Task 3: Deploy to mainnet + record addresses

**Files:**
- Modify: `docs/superpowers/plans/2026-06-10-stx-usdcx-dca-out.md` (record deployed ids inline below)

- [ ] **Step 1: Confirm deploy method with the operator**

These are mainnet, non-custodial contracts deployed by `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV`. Use the project's existing mainnet deployment process (the same one that deployed `dca-vault-sbtc-v2` / `bitflow-usdcx-swap-router` — e.g. `clarinet deployments generate --mainnet` then `clarinet deployments apply --mainnet`, or the Hiro web deployer). Do NOT invent a command; ask the operator which they used previously.

- [ ] **Step 2: Deploy in dependency order**

Order: (1) `dca-vault-stx-usdcx`, (2) `bitflow-usdcx-from-stx-router` (depends on the vault's trait), (3) `batch-dca-executor-v2` (references all three vaults+routers).

- [ ] **Step 3: Verify each deployed contract resolves**

Run (after each confirms):
```bash
curl -s "https://api.hiro.so/v2/contracts/interface/SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV/dca-vault-stx-usdcx" | head -c 120
curl -s "https://api.hiro.so/v2/contracts/interface/SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV/bitflow-usdcx-from-stx-router" | head -c 120
curl -s "https://api.hiro.so/v2/contracts/interface/SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV/batch-dca-executor-v2" | head -c 120
```
Expected: all three return contract interfaces.

- [ ] **Step 4: Commit the recorded addresses**

Write the three confirmed contract ids into this plan file under this task, then:
```bash
git add docs/superpowers/plans/2026-06-10-stx-usdcx-dca-out.md
git commit -m "chore(dca): record deployed STX→USDCx contract addresses"
```

---

## Phase 2 — Keeper bot

### Task 4: Widen BatchPlan vaultType

**Files:**
- Modify: `keeper-bot/src/batch-executor.ts:13-16`

- [ ] **Step 1: Widen the type**

Replace lines 13–16:
```typescript
export interface BatchPlan {
  planId: number;
  vaultType: 0 | 1 | 2; // 0 = STX→sBTC, 1 = sBTC→USDCx, 2 = STX→USDCx
}
```

- [ ] **Step 2: Build the keeper**

Run: `cd keeper-bot && npm run build`
Expected: PASS (no type errors; `tupleCV({ "vault-type": uintCV(p.vaultType) })` already accepts the wider union).

- [ ] **Step 3: Commit**

```bash
git add keeper-bot/src/batch-executor.ts
git commit -m "feat(keeper): widen BatchPlan.vaultType to include 2 (STX→USDCx)"
```

### Task 5: Keeper config for the third vault

**Files:**
- Modify: `keeper-bot/src/config.ts:15-23`, `:62-79`

- [ ] **Step 1: Add the field to BotConfig**

In the `BotConfig` interface (after `sbtcVaultContract` on line 20) add:
```typescript
  stxUsdcxVaultContract: string; // "SP2CMK....dca-vault-stx-usdcx"
```

- [ ] **Step 2: Load it + point batch executor at v2**

In `loadConfig`'s returned object: change the `batchExecutorContract` default to the v2 contract, and add the new vault default (use the address confirmed in Task 3):
```typescript
    batchExecutorContract: optional(
      "BATCH_EXECUTOR_CONTRACT",
      "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.batch-dca-executor-v2"
    ),
```
and after the `sbtcVaultContract` block:
```typescript
    stxUsdcxVaultContract: optional(
      "STX_USDCX_VAULT_CONTRACT",
      "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-stx-usdcx"
    ),
```

- [ ] **Step 3: Build**

Run: `cd keeper-bot && npm run build`
Expected: FAIL — `stxUsdcxVaultContract` is now required by the interface but `StacksClient` does not yet use it; the failure is only if something destructures it. If build passes, good. If it fails, it will be resolved in Task 6. Either way commit after Task 6 if intertwined; otherwise:

- [ ] **Step 4: Commit**

```bash
git add keeper-bot/src/config.ts
git commit -m "feat(keeper): add stxUsdcxVaultContract config, default batch executor to v2"
```

### Task 6: Keeper scans the third vault

**Files:**
- Modify: `keeper-bot/src/stacks-client.ts:9-29`, `:143-169`
- Test: `keeper-bot/src/stacks-client.test.ts` (create if absent — see Step 1)

- [ ] **Step 1: Write a failing unit test for vault routing**

The current `getVault()` picks by `vaultContract.includes("sbtc")`, which misroutes `dca-vault-stx-usdcx` (contains "stx", not "sbtc") to the STX→sBTC SDK instance. Add a test asserting the third vault is addressable. If no test harness exists for the keeper, add Vitest (`keeper-bot` already builds TS; check `keeper-bot/package.json` for a `test` script and add one mirroring the root). Minimal test:

```typescript
import { describe, it, expect } from "vitest";
import { StacksClient } from "./stacks-client.js";
import type { BotConfig } from "./config.js";

const cfg = {
  stxVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault",
  sbtcVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2",
  stxUsdcxVaultContract: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-stx-usdcx",
  hiroApiUrl: "https://api.hiro.so",
} as unknown as BotConfig;

describe("StacksClient vault routing", () => {
  it("exposes a distinct DCAVault for the STX→USDCx contract", () => {
    const c = new StacksClient(cfg);
    // @ts-expect-error private access for the test
    const v = c["getVault"](cfg.stxUsdcxVaultContract);
    expect(v.contractName).toBe("dca-vault-stx-usdcx");
  });
});
```

Run: `cd keeper-bot && npm test`
Expected: FAIL — routing returns the `dca-vault` (stx-to-sbtc) instance, `contractName` ≠ `dca-vault-stx-usdcx`.

- [ ] **Step 2: Add the third vault instance + map-based routing**

Replace the constructor + `getVault` (lines 9–29) with a map keyed by exact contract id, and override `contractName` via the SDK's `VaultConfig`:

```typescript
export class StacksClient {
  private stxVault: DCAVault;
  private sbtcVault: DCAVault;
  private stxUsdcxVault: DCAVault;
  private vaultsById: Map<string, DCAVault>;
  private hiroBreaker = new CircuitBreaker("hiro-rpc");

  constructor(private config: BotConfig) {
    this.stxVault = new DCAVault("stx-to-sbtc", { apiUrl: config.hiroApiUrl });
    this.sbtcVault = new DCAVault("sbtc-to-usdcx", { apiUrl: config.hiroApiUrl });
    // STX→USDCx reuses the stx-to-sbtc preset (same read-only ABI) but overrides
    // the contract name so reads hit the dedicated vault.
    const [, stxUsdcxName] = config.stxUsdcxVaultContract.split(".");
    this.stxUsdcxVault = new DCAVault("stx-to-sbtc", {
      apiUrl: config.hiroApiUrl,
      contractName: stxUsdcxName,
    });
    this.vaultsById = new Map([
      [config.stxVaultContract, this.stxVault],
      [config.sbtcVaultContract, this.sbtcVault],
      [config.stxUsdcxVaultContract, this.stxUsdcxVault],
    ]);
  }

  breakerSnapshot() {
    return this.hiroBreaker.snapshot();
  }

  private getVault(vaultContract: string): DCAVault {
    const v = this.vaultsById.get(vaultContract);
    if (!v) throw new Error(`Unknown vault contract: ${vaultContract}`);
    return v;
  }
```

- [ ] **Step 3: Scan the third vault in `getExecutablePlansForBothVaults`**

Rename the method to `getExecutablePlansForAllVaults` and add the STX→USDCx scan. Replace lines 143–169:

```typescript
  async getExecutablePlansForAllVaults(): Promise<BatchPlan[]> {
    const { stxVaultContract, sbtcVaultContract, stxUsdcxVaultContract } = this.config;

    const [stxTotal, sbtcTotal, stxUsdcxTotal] = await Promise.all([
      this.getTotalPlans(stxVaultContract),
      this.getTotalPlans(sbtcVaultContract),
      this.getTotalPlans(stxUsdcxVaultContract),
    ]);

    log.info("Total plans per vault", { stxTotal, sbtcTotal, stxUsdcxTotal });

    const stxIds = stxTotal > 0 ? await this.getExecutablePlanIds(stxVaultContract, stxTotal) : [];
    const sbtcIds = sbtcTotal > 0 ? await this.getExecutablePlanIds(sbtcVaultContract, sbtcTotal) : [];
    const stxUsdcxIds = stxUsdcxTotal > 0
      ? await this.getExecutablePlanIds(stxUsdcxVaultContract, stxUsdcxTotal)
      : [];

    log.info("Executable plans found", {
      stxExecutable: stxIds.length,
      sbtcExecutable: sbtcIds.length,
      stxUsdcxExecutable: stxUsdcxIds.length,
    });

    const plans: BatchPlan[] = [
      ...stxIds.map((id) => ({ planId: id, vaultType: 0 as const })),
      ...sbtcIds.map((id) => ({ planId: id, vaultType: 1 as const })),
      ...stxUsdcxIds.map((id) => ({ planId: id, vaultType: 2 as const })),
    ];

    return plans;
  }
```

- [ ] **Step 4: Update the caller**

In `keeper-bot/src/index.ts:74`, rename the call:
```typescript
  const plans = await client.getExecutablePlansForAllVaults();
```

- [ ] **Step 5: Run the test + build**

Run: `cd keeper-bot && npm test && npm run build`
Expected: PASS — routing test green, build clean.

- [ ] **Step 6: Commit**

```bash
git add keeper-bot/src/stacks-client.ts keeper-bot/src/index.ts keeper-bot/src/stacks-client.test.ts keeper-bot/package.json
git commit -m "feat(keeper): scan dca-vault-stx-usdcx as vault-type 2"
```

### Task 7: Push notification copy for STX→USDCx

**Files:**
- Modify: `keeper-bot/src/dca-push.ts`
- Test: `keeper-bot/src/dca-push.test.ts` (if a test exists for it; otherwise inline assertion in Step 1)

- [ ] **Step 1: Inspect dca-push.ts**

Read `keeper-bot/src/dca-push.ts` to find where the notification title/body is built per `vaultType`. It currently branches 0 vs 1 ("Bought sBTC" vs "Sold sBTC → USDCx" or similar).

- [ ] **Step 2: Add the vault-type 2 branch**

Add a branch so `vaultType === 2` produces copy like: title `"STX sold"`, body `"Your scheduled STX → USDCx sell executed."` Match the exact shape/wording style of the existing 0/1 branches (do not introduce a new notification structure).

- [ ] **Step 3: Build**

Run: `cd keeper-bot && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add keeper-bot/src/dca-push.ts
git commit -m "feat(keeper): push copy for STX→USDCx executions"
```

---

## Phase 3 — Frontend lib

### Task 8: Contract ids for STX→USDCx

**Files:**
- Modify: `src/lib/dca-contracts.ts`

- [ ] **Step 1: Add the ids**

After the `DCA_SBTC_*` block in `src/lib/dca-contracts.ts`:
```typescript
export const DCA_STX_USDCX_CONTRACT_ADDRESS =
  "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV";
export const DCA_STX_USDCX_CONTRACT_NAME = "dca-vault-stx-usdcx";
export const DCA_STX_USDCX_CONTRACT_ID =
  `${DCA_STX_USDCX_CONTRACT_ADDRESS}.${DCA_STX_USDCX_CONTRACT_NAME}`;
```

- [ ] **Step 2: Typecheck**

Run: `npm run build` (or `npx tsc --noEmit` if faster)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dca-contracts.ts
git commit -m "feat(dca): add STX→USDCx vault contract ids"
```

### Task 9: dca-stx-usdcx lib (read + write helpers)

**Files:**
- Create: `src/lib/dca-stx-usdcx.ts`
- Test: `src/lib/dca-stx-usdcx.test.ts`

- [ ] **Step 1: Write a failing unit test for the pure aggregator**

The lib mirrors `dca-sbtc.ts` but the source unit is STX (uSTX, 6 decimals) instead of sBTC sats, and the target is USDCx (6 decimals). Test the pure performance aggregator first:

```typescript
import { describe, it, expect } from "vitest";
import { aggregateStxUsdcxPlanPerformance, type StxUsdcxExecutionEvent } from "./dca-stx-usdcx";

describe("aggregateStxUsdcxPlanPerformance", () => {
  it("computes avg USDCx per STX from successful events", () => {
    const events: StxUsdcxExecutionEvent[] = [
      { txId: "a", blockHeight: 1, blockTime: 100, status: "success", stxIn: 2_000_000, tokenOut: 1_500_000 },
      { txId: "b", blockHeight: 2, blockTime: 200, status: "success", stxIn: 2_000_000, tokenOut: 1_600_000 },
    ];
    const p = aggregateStxUsdcxPlanPerformance(1, events, 6);
    expect(p.executionCount).toBe(2);
    expect(p.totalStxIn).toBe(4_000_000);       // uSTX
    expect(p.totalTokenOut).toBeCloseTo(3.1);   // (1.5 + 1.6) USDCx
    expect(p.avgTokenPerStx).toBeCloseTo(3.1 / 4); // tokens per 1 STX
  });
});
```

Run: `npx vitest run src/lib/dca-stx-usdcx.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement the lib**

Create `src/lib/dca-stx-usdcx.ts` by copying `src/lib/dca-sbtc.ts` and applying these exact substitutions:
- Import ids from `./dca-contracts`: `DCA_STX_USDCX_CONTRACT_ADDRESS` / `_NAME` (alias them to `DCA_SBTC_CONTRACT_ADDRESS`/`NAME` usages).
- `DEFAULT_SBTC_SWAP_ROUTER` → `DEFAULT_STX_USDCX_SWAP_ROUTER = "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-usdcx-from-stx-router"`.
- Source unit helpers: remove `satsToBTC`/`btcToSats`/`SBTC_DECIMALS`; STX is 6 decimals — reuse `stxToMicro`/`microToSTX` from `./dca` (import them) for display. The source amount field is uSTX.
- Rename exported symbols: `DCA_SBTCStats`→`DcaStxUsdcxStats`, `DCA_SBTCPlan`→`StxUsdcxPlan` (field `tss` = total uSTX spent), `SBTCPlanExecutionEvent`→`StxUsdcxExecutionEvent` with `stxIn?: number` replacing `sbtcIn?`, `SBTCPlanPerformance`→`StxUsdcxPerformance` with `totalStxIn` replacing `totalSbtcIn` and `avgTokenPerStx`/`avgStxPerToken` replacing the sBTC variants, `aggregateSBTCPlanPerformance`→`aggregateStxUsdcxPlanPerformance` (divide stxIn by 1e6, not 1e8), and all `*SBTC*` function names → `*StxUsdcx*`.
- `parseStxUsdcxExecuteResult`: same regex on `net-swapped u(\d+)` (the vault prints uSTX) — keep `protocolFeeStx` (the fee leg is paid in STX in both vaults).
- `SBTC_TARGET_TOKENS` → `STX_USDCX_TARGET_TOKENS` = `[{ label: "USDCx", value: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx" }]`.
- `SBTC_INTERVALS` → reuse `INTERVALS` from `./dca` (the STX vault block intervals); keep a local `blocksToInterval` only if the sBTC one differs. (STX vault uses the same Nakamoto intervals; import `INTERVALS` from `./dca`.)
- The `getStxUsdcxBalance` read uses the native STX balance — import and reuse `getSTXBalance` from `./dca` instead of an sBTC token read.

Keep the file's structure, `parseCV`/`readOnly` helpers, and write functions (`createStxUsdcxPlan`, `depositToStxUsdcxPlan`, `cancelStxUsdcxPlan`, `pauseStxUsdcxPlan`, `resumeStxUsdcxPlan`) one-for-one with the sBTC versions, pointing `contractAddress/Name` at the new vault. `create-plan` args are identical (target, amount, interval, deposit) — USDCx is the fixed target.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/lib/dca-stx-usdcx.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dca-stx-usdcx.ts src/lib/dca-stx-usdcx.test.ts
git commit -m "feat(dca): dca-stx-usdcx lib (STX→USDCx reads, writes, performance)"
```

---

## Phase 4 — Frontend UI

### Task 10: Source-asset toggle in the DCA-out tab

**Files:**
- Modify: `src/components/dca/DCAPageContent.tsx`
- Create: `src/components/dca-out/OutSourceToggle.tsx`

- [ ] **Step 1: Build the toggle component**

Create `src/components/dca-out/OutSourceToggle.tsx` — a two-option segmented control (`"sbtc"` | `"stx"`) styled like the existing `in`/`out` tab toggle in `DCAHeroSection`. Props: `value: "sbtc" | "stx"`, `onChange: (v) => void`. Labels via `useTranslations("dca")` keys `outSourceSbtc` / `outSourceStx` (added in Task 13).

```tsx
"use client";
import { useTranslations } from "next-intl";

export type OutSource = "sbtc" | "stx";

export default function OutSourceToggle({
  value,
  onChange,
}: {
  value: OutSource;
  onChange: (v: OutSource) => void;
}) {
  const t = useTranslations("dca");
  const opts: { id: OutSource; label: string }[] = [
    { id: "sbtc", label: t("outSourceSbtc") },
    { id: "stx", label: t("outSourceStx") },
  ];
  return (
    <div className="inline-flex rounded-lg p-1" style={{ background: "var(--bg-surface)" }}>
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors"
          style={{
            background: value === o.id ? "var(--accent)" : "transparent",
            color: value === o.id ? "var(--accent-fg)" : "var(--text-muted)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```
(Match the actual CSS-var token names used elsewhere in `dca-out/` — confirm against `OutPlanCard.tsx`; the values above are placeholders for whatever the file already uses.)

- [ ] **Step 2: Wire it into the out tab**

In `src/components/dca/DCAPageContent.tsx`, add `const [outSource, setOutSource] = useState<OutSource>("sbtc");` and in the `tab === "out"` branch (around line 90–97) render `<OutSourceToggle value={outSource} onChange={setOutSource} />` above the form, then conditionally render the sBTC form/list (existing) when `outSource === "sbtc"` and the STX variants (Task 11/12) when `"stx"`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS (STX variant components are added next; until then, gate the `"stx"` branch to render `null` so the build is green, then fill in Task 11/12).

- [ ] **Step 4: Commit**

```bash
git add src/components/dca-out/OutSourceToggle.tsx src/components/dca/DCAPageContent.tsx
git commit -m "feat(dca): source toggle (sBTC/STX) in DCA-out tab"
```

### Task 11: STX-out create form

**Files:**
- Create: `src/components/dca-out/CreateStxOutPlanForm.tsx`

- [ ] **Step 1: Build the form**

Copy `src/components/dca-out/CreateOutPlanForm.tsx` to `CreateStxOutPlanForm.tsx` and apply:
- Import from `@/lib/dca-stx-usdcx` instead of `@/lib/dca-sbtc` (the symbols renamed in Task 9).
- Source token row: STX (not sBTC). Amount input + deposit input are in STX; convert via `stxToMicro` (from `@/lib/dca`). Min swap 1 STX, min deposit 2 STX (mirror the STX vault constants — same thresholds the DCA-in form in `src/components/dca/CreatePlanForm.tsx` uses).
- Balance source: `getSTXBalance` (already used by `CreatePlanForm.tsx`).
- Target stays USDCx (fixed; copy the existing USDCx target row).
- Call `createStxUsdcxPlan(...)` on submit.

- [ ] **Step 2: Render it in the out tab**

In `DCAPageContent.tsx`, in the `outSource === "stx"` branch, render `<CreateStxOutPlanForm onCreated={handleOutRefresh} />`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/dca-out/CreateStxOutPlanForm.tsx src/components/dca/DCAPageContent.tsx
git commit -m "feat(dca): STX→USDCx create-plan form"
```

### Task 12: STX-out plan list + card + history

**Files:**
- Create: `src/components/dca-out/MyStxOutPlans.tsx`, `src/components/dca-out/StxOutPlanCard.tsx`, `src/components/dca-out/StxOutPlanHistory.tsx`

- [ ] **Step 1: Build the list**

Copy `MyOutPlans.tsx` → `MyStxOutPlans.tsx`: swap `@/lib/dca-sbtc` for `@/lib/dca-stx-usdcx` (`getStxUsdcxUserPlans`, `StxUsdcxPlan`), render `<StxOutPlanCard>` per plan.

- [ ] **Step 2: Build the card**

Copy `OutPlanCard.tsx` → `StxOutPlanCard.tsx`: STX units for source amount/balance (`microToSTX`), USDCx for target. Wire `cancelStxUsdcxPlan`/`pauseStxUsdcxPlan`/`resumeStxUsdcxPlan`/`depositToStxUsdcxPlan`. History via `<StxOutPlanHistory>`.

- [ ] **Step 3: Build the history**

Copy `OutPlanHistory.tsx` → `StxOutPlanHistory.tsx`: use `getStxUsdcxPlanExecutionHistory` + `aggregateStxUsdcxPlanPerformance`; display `stxIn` (STX) → `tokenOut` (USDCx).

- [ ] **Step 4: Render the list in the out tab**

In `DCAPageContent.tsx` `outSource === "stx"` branch, render `<MyStxOutPlans address={stxAddress!} key={...} />` mirroring the sBTC `MyOutPlans` wiring.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/dca-out/MyStxOutPlans.tsx src/components/dca-out/StxOutPlanCard.tsx src/components/dca-out/StxOutPlanHistory.tsx src/components/dca/DCAPageContent.tsx
git commit -m "feat(dca): STX→USDCx plan list, card, history"
```

### Task 13: i18n keys (EN + VI)

**Files:**
- Modify: `messages/en/dca.json`, `messages/vi/dca.json` (confirm exact path/namespace layout first)

- [ ] **Step 1: Locate the dca namespace files**

Run: `ls messages/*/dca.json 2>/dev/null || find . -name "dca.json" -not -path "*/node_modules/*"`
Open the EN and VI files.

- [ ] **Step 2: Add keys to EN**

Add (matching existing key style in the file):
```json
"outSourceSbtc": "Sell sBTC",
"outSourceStx": "Sell STX",
"stxOutTitle": "Sell STX → USDCx",
"stxOutDesc": "Schedule recurring sells of STX into USDCx."
```
Plus any string the STX forms/cards reference (mirror the sBTC-out keys, prefixed/renamed for STX). Cross-check every `t("…")` call added in Tasks 10–12 has a key here.

- [ ] **Step 3: Add the same keys to VI**

```json
"outSourceSbtc": "Bán sBTC",
"outSourceStx": "Bán STX",
"stxOutTitle": "Bán STX → USDCx",
"stxOutDesc": "Lên lịch bán STX định kỳ vào USDCx."
```

- [ ] **Step 4: Run the i18n parity test**

Run: `npx vitest run` against the message-parity test (find it: `grep -rl "parity\|messages" --include=*.test.ts src e2e | head`). Expected: PASS — EN and VI key sets match.

- [ ] **Step 5: Commit**

```bash
git add messages/en/dca.json messages/vi/dca.json
git commit -m "feat(i18n): STX→USDCx DCA-out strings (en, vi)"
```

### Task 14: Performance panel includes STX-out

**Files:**
- Modify: `src/components/dca/performance/DCAOutPanel.tsx`

- [ ] **Step 1: Add the STX-out source**

In `DCAOutPanel.tsx`, add a source switch (or a second section) that, for STX-out, fetches via `getAllStxUsdcxUserPlans` + `getStxUsdcxPlanExecutionHistory` and renders the existing `CostBasisOutChart` with STX-as-source labels. Reuse the same layout as the sBTC-out path — do not fork the chart component; pass STX-denominated series in.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/dca/performance/DCAOutPanel.tsx
git commit -m "feat(dca): performance panel shows STX→USDCx source"
```

---

## Phase 5 — E2E + final verification

### Task 15: E2E create-STX-out-plan

**Files:**
- Modify/Create: `e2e/dca.spec.ts` (or a new `e2e/dca-out-stx.spec.ts`)

- [ ] **Step 1: Add the test**

Using the mock-wallet fixture (`e2e/fixtures/test-utils.ts`), add a test that: connects the mock wallet, navigates to `/dca`, switches to the `out` tab, clicks the STX source toggle, fills the STX-out form (amount ≥ 1 STX, deposit ≥ 2 STX), and asserts the create-plan flow opens the signing path (mock). Mirror the existing DCA-out sBTC e2e assertions.

- [ ] **Step 2: Run e2e (chromium first)**

Run: `npx playwright test e2e/dca.spec.ts --project=chromium`
Expected: PASS. Then full: `npm run test:e2e`.

- [ ] **Step 3: Commit**

```bash
git add e2e/
git commit -m "test(e2e): create STX→USDCx DCA-out plan"
```

### Task 16: Full verification

**Files:** none.

- [ ] **Step 1: Lint + build + unit + contracts**

Run, reading each output before claiming done:
```bash
npm run lint
npm run build
npx vitest run
cd keeper-bot && npm run build && npm test && cd ..
cd contracts && clarinet check && cd ..
```
Expected: all green.

- [ ] **Step 2: Free port 3000 if a dev server was started**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null || true`

- [ ] **Step 3: Final confirmation**

Confirm against the spec's section 5 data flow that a STX→USDCx plan, once created and due, is scanned as vault-type 2, executed by `batch-dca-executor-v2`, and credits USDCx to the owner. No code — checklist only.

---

## Notes / risks carried from the spec

- **Pre-existing v1/v2 STX-buy discrepancy:** `batch-dca-executor` (and keeper config default) point vault-type 0 at `dca-vault` (v1), while the frontend buy path uses `dca-vault-v2`. This plan does NOT touch that; it copies the better v2 code for the *new* STX→USDCx vault. Flag to the operator but keep out of scope.
- **SDK coupling:** the keeper reaches the new vault via `DCAVault("stx-to-sbtc", { contractName })`. This works because all three vaults share the same read-only ABI (`get-stats`/`get-plan`/`can-execute`/`get-user-plans`). If a future SDK bump changes the preset ABI, revisit Task 6.
- **No price gating:** Smart-DCA gating stays vault-0-only; STX-out executes straight on schedule (per approved spec — take-profit-by-price is explicitly out of scope).
```
